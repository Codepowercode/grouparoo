import { SimpleAppOptions } from "@grouparoo/core";
import axios from "axios";

export async function updateSubscriber(appOptions: SimpleAppOptions, data, id) {
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + `/api/subscribers/${id}`;

  const response = await axios.put(url, data, {
    auth: {
      username: appOptions.username as string,
      password: appOptions.password as string,
    }
  });

  return response.data.data;
}