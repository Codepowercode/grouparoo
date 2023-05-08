import { TestPluginMethod } from "@grouparoo/core";
import axios from "axios";

export const test: TestPluginMethod = async ({ appOptions }) => {
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + '/api/subscribers';

  try {
    await axios.get(url, {
      auth: {
        username: appOptions.username as string,
        password: appOptions.password as string,
      },
    })
  } catch(err) {
    console.error(err);
    return {
      success: false,
      message: 'Listmonk credentials are incorrect',
    }
  }

  return {
    success: true,
    message: 'Listmonk test success',
  }
};
