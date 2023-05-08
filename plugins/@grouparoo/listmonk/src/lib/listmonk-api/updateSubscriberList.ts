import { SimpleAppOptions } from "@grouparoo/core";
import axios from "axios";

export async function updateSubscriberList(appOptions: SimpleAppOptions, subscriberIds, listIds, action) {
  console.log('------------ updateSubscriberList START ------------');
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + `/api/subscribers/lists`;

  const body = {
    ids: subscriberIds,
    target_list_ids: listIds,
    action,
  };
  if (action === 'add') {
    // @ts-ignore
    body.status = 'confirmed';
  }
  console.log(body);

  const response = await axios.put(url, body, {
    auth: {
      username: appOptions.username as string,
      password: appOptions.password as string,
    }
  });

  return response.data.data;
}