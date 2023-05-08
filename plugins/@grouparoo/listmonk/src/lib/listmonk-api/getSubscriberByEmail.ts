import { SimpleAppOptions } from "@grouparoo/core";
import axios from "axios";

export async function getSubscriberByEmail(appOptions: SimpleAppOptions, email) {
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + '/api/subscribers';
  const sqlQuery = `subscribers.email = '${email}'`;

  const response = await axios.get(url, {
    auth: {
      username: appOptions.username as string,
      password: appOptions.password as string,
    },
    params: {
      query: sqlQuery,
    }
  });

  const subscriber = response.data.data?.results?.[0] ? response.data.data.results[0] : null;

  return subscriber;
}