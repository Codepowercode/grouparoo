import { Initializer } from "actionhero";
import { plugin } from "@grouparoo/core";

import { test } from "./../lib/test";
import { parallelism } from "./../lib/parallelism";

import { emailDestinationConnection } from "../lib/export/connection";

const packageJSON = require("./../../package.json");

export class Plugins extends Initializer {
  constructor() {
    super();
    this.name = packageJSON.name;
  }

  async initialize() {
    plugin.registerPlugin({
      name: packageJSON.name,
      icon: "/public/@grouparoo/listmonk/listmonk.svg",
      apps: [
        {
          name: "listmonk",
          displayName: "Listmonk",
          options: [
            {
              key: "username",
              type: "text",
              displayName: "Username",
              required: true,
              description: "Listmonk username.",
            },
            {
              key: "password",
              type: "password",
              displayName: "Password",
              required: true,
              description: "Listmonk user password.",
            },
            {
              key: "host",
              type: "text",
              displayName: "Host",
              required: true,
              description: "Listmonk server host.",
            },
            {
              key: "port",
              type: "text",
              displayName: "Port",
              required: true,
              description: "Listmonk server port.",
            },
          ],
          methods: { test, parallelism },
        },
      ],
      connections: [
        emailDestinationConnection,
      ],
    });
  }

  async start() {
    plugin.mountModels();
  }
}
