import { PluginConnection, DestinationSyncMode, Errors } from "@grouparoo/core";
import { getSubscriberByEmail } from "../listmonk-api/getSubscriberByEmail";
import { deleteSubscriberById } from "../listmonk-api/deleteSubscriberById";
import { createSubscriber } from "../listmonk-api/createSubscriber";
import { updateSubscriber } from "../listmonk-api/updateSubscriber";
import { updateSubscriberList } from "../listmonk-api/updateSubscriberList";
import { createList } from "../listmonk-api/createList";

export const emailSupportedSyncModes: DestinationSyncMode[] = [
  "sync",
  "additive",
  "enrich",
];

export const emailDestinationConnection: PluginConnection = {
  name: "listmonk-export",
  displayName: "Listmonk Export",
  direction: "export",
  description: "Export Records to a Listmonk subscribers.",
  apps: ["listmonk"],
  syncModes: emailSupportedSyncModes,
  defaultSyncMode: "sync",
  options: [],
  methods: {
    // destinationOptions: getDestinationOptions(["listId"]),
    // destinationMappingOptions: getDestinationMappingOptions("email"),
    // exportRecord,
    // exportArrayProperties,
    destinationOptions: async () => { return {} },
    destinationMappingOptions: async () => {
      return {
        labels: {
          property: {
            singular: 'Listmonk Key',
            plural: 'Listmonk Keys',
          },
          group: {
            singular: 'Listmonk List',
            plural: 'Listmonk Lists',
          }
        },
        properties: {
          required: [
            {
              key: 'email',
              type: 'email',
              important: true,
            },
            {
              key: 'name',
              type: 'string',
              important: true,
            },
            {
              key: 'status',
              type: 'string',
              important: true,
            },
          ],
          known: [
            {
              key: 'lists',
              type: 'any',
            },
            {
              key: 'attribs',
              type: 'any',
            },
            {
              key: 'preconfirm_subscriptions',
              type: 'boolean',
            },
          ],
          allowOptionalFromProperties: false,
        }
      }
    },
    exportRecord: async ({ appOptions, syncOperations, export: profileToExport }) => {
      const {
        toDelete,
        newRecordProperties,
        oldRecordProperties,
        oldGroups,
        newGroups,
      } = profileToExport;

      // if we received no mapped data... just exit
      if (Object.keys(newRecordProperties).length === 0) {
        return { success: true };
      }

      const email = newRecordProperties['email']; // this is a required key for
      if (!email || !newRecordProperties['name'] || !newRecordProperties['status']) {
        throw new Error(`newRecordProperties[email], newRecordProperties[name], and newRecordProperties[status] is a required mapping`);
      }
      const subscriber = await getSubscriberByEmail(appOptions, email);

      if (subscriber && toDelete) {
        try {
          await deleteSubscriberById(appOptions, subscriber.id);
          return { success: true };
        } catch (err) {
          console.error(err);
          return { success: false };
        }
      }
      if (!subscriber && !syncOperations.create) {
        throw new Errors.InfoError(
          "Destination sync mode does not allow creating new records."
        );
      } else if (subscriber && !syncOperations.update) {
        throw new Errors.InfoError(
          "Destination sync mode does not allow updating existing records."
        );
      }

      if (!subscriber) {
        console.log(1);
        const createdSubscriber = await createSubscriber(appOptions, newRecordProperties);
        console.log(2);
        const asyncTasks = [];
        for (const groupName of newGroups) {
          asyncTasks.push(createList(appOptions, groupName));
        }
        console.log(3);
        const createdLists = (await Promise.allSettled(asyncTasks)).map((result) => {
          if (result.status === 'fulfilled') {
            return result.value;
          }
        });
        console.log(4);
        const createdListIds = createdLists.map((i) => i.id);
        console.log({ createdListIds });
        await updateSubscriberList(appOptions, [createdSubscriber.id], createdListIds, 'add');
        console.log(5);
        return { success: true };
      } else {
        const oldKeys = Object.keys(oldRecordProperties);

        for (const oldKey of oldKeys) {
          if (newRecordProperties[oldKey] === undefined) {
            newRecordProperties[oldKey] = null;
          }
        }

        await updateSubscriber(appOptions, newRecordProperties, subscriber.id);

        const oldListIds = subscriber.lists.map((list) => {
          if (oldGroups.includes(list.name)) {
            return list.id;
          }
        });
        await updateSubscriberList(appOptions, [subscriber.id], oldListIds, 'remove');

        const asyncTasks = [];
        for (const groupName of newGroups) {
          asyncTasks.push(createList(appOptions, groupName));
        }
        const createdLists = (await Promise.allSettled(asyncTasks)).map((result) => {
          if (result.status === 'fulfilled') {
            return result.value;
          }
        });
        const createdListIds = createdLists.map((i) => i.id);
        await updateSubscriberList(appOptions, [subscriber.id], createdListIds, 'add');


        return { success: true }
      }
    },
    exportArrayProperties: async () => {
      return ['lists']
    }
  },
};
