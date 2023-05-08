import { SimpleAppOptions } from "@grouparoo/core";
import axios from "axios";

export async function createList(appOptions: SimpleAppOptions, listName) {
  const baseURL = `http://${appOptions.host}:${appOptions.port}`;
  const url = baseURL + '/api/lists';

  const listResponse = await axios.get(url, {
    auth: {
      username: appOptions.username as string,
      password: appOptions.password as string,
    },
    params: {
      query: listName,
    }
  });

  let createdList;

  if (listResponse.data.data?.total === 0) {
    const response = await axios.post(url, {
      name: listName,
      type: 'private',
      optin: 'single',
    }, {
      auth: {
        username: appOptions.username as string,
        password: appOptions.password as string,
      }
    });
  
    createdList = response.data.data;
  } else {
    createdList = listResponse.data.data?.results?.[0];
  }


  return createdList;
}