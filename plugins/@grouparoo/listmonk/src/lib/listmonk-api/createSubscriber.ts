import { SimpleAppOptions } from "@grouparoo/core";
import axios from "axios";

export async function createSubscriber(appOptions: SimpleAppOptions, subscriberData) {
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + '/api/subscribers';

  const response = await axios.post(url, subscriberData, {
    auth: {
      username: appOptions.username as string,
      password: appOptions.password as string,
    }
  });

  const createdSubscriber = response.data.data;

  return createdSubscriber;
}