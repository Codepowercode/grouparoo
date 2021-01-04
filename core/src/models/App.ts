import {
  Table,
  Column,
  Default,
  Length,
  AllowNull,
  BeforeSave,
  DataType,
  BeforeDestroy,
  BeforeCreate,
  AfterDestroy,
  HasMany,
  DefaultScope,
} from "sequelize-typescript";
import { api, redis } from "actionhero";
import { Op, Transaction } from "sequelize";
import { LoggedModel } from "../classes/loggedModel";
import { Source } from "./Source";
import { Option } from "./Option";
import { OptionHelper } from "./../modules/optionHelper";
import { StateMachine } from "./../modules/stateMachine";
import { Destination } from "./Destination";
import { AppOps } from "../modules/ops/app";
import { LockableHelper } from "../modules/lockableHelper";

export interface AppOption {
  key: string;
  displayName?: string;
  required: boolean;
  description?: string;
  placeholder?: string;
}

export interface SimpleAppOptions extends OptionHelper.SimpleOptions {}

const STATES = ["draft", "ready"] as const;
const STATE_TRANSITIONS = [
  {
    from: "draft",
    to: "ready",
    checks: [
      (instance: App, transaction?: Transaction) =>
        instance.validateOptions(null, transaction),
    ],
  },
];

@DefaultScope(() => ({
  where: { state: "ready" },
}))
@Table({ tableName: "apps", paranoid: false })
export class App extends LoggedModel<App> {
  guidPrefix() {
    return "app";
  }

  @AllowNull(true)
  @Length({ min: 0, max: 191 })
  @Default("")
  @Column
  name: string;

  @AllowNull(false)
  @Column
  type: string;

  @AllowNull(true)
  @Column
  locked: string;

  @AllowNull(false)
  @Default("draft")
  @Column(DataType.ENUM(...STATES))
  state: typeof STATES[number];

  @HasMany(() => Option, "ownerGuid")
  _options: Option[]; // the underscore is needed as "options" is an internal method on sequelize instances

  @HasMany(() => Source)
  sources: Array<Source>;

  async appOptions() {
    const { pluginApp } = await this.getPlugin();
    if (!pluginApp?.methods?.appOptions) return {};
    return pluginApp.methods.appOptions();
  }

  async getOptions(sourceFromEnvironment = true, transaction?: Transaction) {
    return OptionHelper.getOptions(this, sourceFromEnvironment, transaction);
  }

  async setOptions(options: SimpleAppOptions, transaction?) {
    return OptionHelper.setOptions(this, options, transaction);
  }

  async afterSetOptions(hasChanges: boolean) {
    if (hasChanges) await redis.doCluster("api.rpc.app.disconnect");
  }

  async validateOptions(options?: SimpleAppOptions, transaction?: Transaction) {
    if (!options) options = await this.getOptions(true, transaction);
    return OptionHelper.validateOptions(this, options, null, transaction);
  }

  async getPlugin(transaction?: Transaction) {
    return OptionHelper.getPlugin(this, transaction);
  }

  async setConnection(connection) {
    api.plugins.persistentConnections[this.guid] = connection;
  }

  async getConnection(transaction?: Transaction) {
    const connection = api.plugins.persistentConnections[this.guid];
    if (!connection) return this.connect(null, transaction);
    return connection;
  }

  async connect(options?: SimpleAppOptions, transaction?: Transaction) {
    return AppOps.connect(this, options, null, transaction);
  }

  async disconnect(transaction?: Transaction) {
    return AppOps.disconnect(this, undefined, transaction);
  }

  async test(options?: SimpleAppOptions, transaction?: Transaction) {
    return AppOps.test(this, options, transaction);
  }

  async getParallelism(): Promise<number> {
    const { pluginApp } = await this.getPlugin();
    const method = pluginApp.methods.parallelism;

    if (!method) return Infinity;

    const appOptions = await this.getOptions();
    return method({ app: this, appOptions });
  }

  async checkAndUpdateParallelism(direction: "incr" | "decr") {
    const key = this.parallelismKey();
    const redis = api.redis.clients.client;
    const limit = await this.getParallelism();
    const count = await redis[direction](key);
    if (count < 0) {
      // invalid. how did this happen? reset it
      await redis.set(key, 0);
    }
    if (count <= limit || direction === "decr") {
      return true;
    } else {
      // move it back down because incremented
      await redis.decr(key);
      return false;
    }
  }

  parallelismKey() {
    return `app:${this.guid}:ratelimit:parallel`;
  }

  async apiData() {
    const options = await this.getOptions(false);
    const icon = await this._getIcon();
    const provides = this.provides();

    return {
      guid: this.guid,
      name: this.name,
      icon,
      type: this.type,
      state: this.state,
      locked: this.locked,
      options,
      provides,
      createdAt: this.createdAt ? this.createdAt.getTime() : null,
      updatedAt: this.updatedAt ? this.updatedAt.getTime() : null,
    };
  }

  /**
   * Determine if this App can provide Source or Destination Connections
   */
  provides() {
    const source = api.plugins.plugins.find((p) =>
      p?.connections?.find(
        (c) => c.app === this.type && c.direction === "import"
      )
    )
      ? true
      : false;

    const destination = api.plugins.plugins.find((p) =>
      p?.connections?.find(
        (c) => c.app === this.type && c.direction === "export"
      )
    )
      ? true
      : false;

    return { source, destination };
  }

  async _getIcon() {
    const { plugin } = await this.getPlugin();
    return plugin?.icon;
  }

  // --- Class Methods --- //

  static async findByGuid(guid: string, transaction?: Transaction) {
    const instance = await this.scope(null).findOne({
      where: { guid },
      transaction,
    });
    if (!instance) throw new Error(`cannot find ${this.name} ${guid}`);
    return instance;
  }

  // Disconnect all Apps from their persistent connections
  static async disconnect() {
    const apps = await App.findAll();
    for (const i in apps) await apps[i].disconnect();
  }

  @BeforeCreate
  static async checkMaxInstances(instance: App, { transaction }) {
    const count = await App.scope(null).count({
      where: { type: instance.type },
      transaction,
    });
    const { pluginApp } = await instance.getPlugin();
    if (
      pluginApp &&
      pluginApp.maxInstances &&
      pluginApp.maxInstances < count + 1
    ) {
      throw new Error(
        `cannot create a new ${instance.type} app, only ${pluginApp.maxInstances} allowed`
      );
    }
  }

  @BeforeSave
  static async ensureUniqueName(instance: App, { transaction }) {
    const count = await App.count({
      where: {
        guid: { [Op.ne]: instance.guid },
        name: instance.name,
        state: { [Op.ne]: "draft" },
      },
      transaction,
    });
    if (count > 0) throw new Error(`name "${instance.name}" is already in use`);
  }

  @BeforeSave
  static async validateType(instance: App) {
    const { pluginApp } = await instance.getPlugin();
    if (!pluginApp) {
      throw new Error(`cannot find a pluginApp for type ${instance.type}`);
    }
  }

  @BeforeSave
  static async updateState(instance: App, { transaction }) {
    await StateMachine.transition(instance, STATE_TRANSITIONS, transaction);
  }

  @BeforeSave
  static async noUpdateIfLocked(instance) {
    await LockableHelper.beforeSave(instance, ["state"]);
  }

  @BeforeDestroy
  static async noDestroyIfLocked(instance) {
    await LockableHelper.beforeDestroy(instance);
  }

  @BeforeDestroy
  static async checkDependents(instance: App, { transaction }) {
    const sources = await Source.scope(null).findAll({
      where: { appGuid: instance.guid },
      transaction,
    });
    if (sources.length > 0) {
      throw new Error(
        `cannot delete this app, source ${sources[0].guid} relies on it`
      );
    }

    const destinations = await Destination.scope(null).findAll({
      where: { appGuid: instance.guid },
      transaction,
    });
    if (destinations.length > 0) {
      throw new Error(
        `cannot delete this app, destination ${destinations[0].guid} relies on it`
      );
    }
  }

  @BeforeDestroy
  static async checkMinInstances(instance: App) {
    const count = await App.scope(null).count({
      where: { type: instance.type },
    });
    const { pluginApp } = await instance.getPlugin();
    if (
      pluginApp &&
      pluginApp.minInstances &&
      pluginApp.minInstances > count - 1
    ) {
      throw new Error(
        `cannot delete this ${instance.type} app, at least ${pluginApp.minInstances} required`
      );
    }
  }

  @AfterDestroy
  static async destroyOptions(instance: App, { transaction }) {
    return Option.destroy({
      where: {
        ownerGuid: instance.guid,
      },
      transaction,
    });
  }

  @AfterDestroy
  static async removeParallelismKey(instance: App) {
    const key = instance.parallelismKey();
    const redis = api.redis.clients.client;
    return redis.del(key);
  }
}