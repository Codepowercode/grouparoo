import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import Link from "next/link";
import Router from "next/router";
import Pagination from "../pagination";
import LoadingTable from "../loadingTable";
import Moment from "react-moment";
import AppIcon from "../appIcon";

export default function (props) {
  const {
    apiVersion,
    errorHandler,
    sourceHandler,
    successHandler,
    query,
  } = props;
  const { execApi } = useApi(errorHandler);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [total, setTotal] = useState(0);

  // pagination
  const limit = 100;
  const [offset, setOffset] = useState(query.offset || 0);

  useEffect(() => {
    load();

    sourceHandler.subscribe("team-list", load);

    return () => {
      sourceHandler.unsubscribe("team-list", load);
    };
  }, [offset, limit]);

  async function load() {
    updateURLParams();
    setLoading(true);
    const response = await execApi("get", `/api/${apiVersion}/sources`, {
      limit,
      offset,
    });
    setLoading(false);
    if (response?.sources) {
      setSources(response.sources);
      setTotal(response.total);
    }
  }

  async function updateURLParams() {
    let url = `${window.location.pathname}?`;
    if (offset && offset !== 0) {
      url += `offset=${offset}&`;
    }

    Router.push(Router.route, url, { shallow: true });
  }

  return (
    <>
      <p>{total} sources</p>

      <Pagination
        total={total}
        limit={limit}
        offset={offset}
        onPress={setOffset}
      />

      <LoadingTable loading={loading}>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Type</th>
            <th>App</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            return (
              <tr key={`source-${source.guid}`}>
                <td>
                  <AppIcon src={source.app?.icon} />
                </td>
                <td>
                  <Link href="/source/[guid]" as={`/source/${source.guid}`}>
                    <a>
                      {" "}
                      <strong>{source.name}</strong>
                      <br />
                      {source.guid}
                    </a>
                  </Link>
                </td>
                <td>{source.type}</td>
                <td>
                  <Link href="/app/[guid]" as={`/app/${source.app.guid}`}>
                    <a>
                      <strong>{source.app.name}</strong>
                      <br />
                      {source.app.guid}
                    </a>
                  </Link>
                </td>
                <td>
                  <Moment fromNow>{source.createdAt}</Moment>
                </td>
              </tr>
            );
          })}
        </tbody>
      </LoadingTable>

      <Pagination
        total={total}
        limit={limit}
        offset={offset}
        onPress={setOffset}
      />
    </>
  );
}
