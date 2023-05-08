import { SimpleAppOptions } from "@grouparoo/core";
import axios from "axios";

export async function deleteSubscriberById(appOptions: SimpleAppOptions, id) {
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + `/api/subscribers/${id}`;

  await axios.delete(url, {
    auth: {
      username: appOptions.username as string,
      password: appOptions.password as string,
    },
  });
}