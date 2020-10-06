import Head from "next/head";
import { Button, Badge } from "react-bootstrap";
import { useRouter } from "next/router";
import { useApi } from "../hooks/useApi";
import { useOffset, updateURLParams } from "../hooks/URLParams";
import { useState } from "react";
import { useSecondaryEffect } from "../hooks/useSecondaryEffect";
import Link from "next/link";
import Pagination from "../components/pagination";
import LoadingTable from "../components/loadingTable";
import Moment from "react-moment";
import AppIcon from "../components/appIcon";
import StateBadge from "../components/stateBadge";

import { DestinationAPIData } from "../utils/apiData";

export default function Page(props) {
  const { errorHandler } = props;
  const router = useRouter();
  const { execApi } = useApi(props, errorHandler);
  const [loading, setLoading] = useState(false);
  const [destinations, setDestinations] = useState<DestinationAPIData[]>(
    props.destinations
  );
  const [total, setTotal] = useState(props.total);

  // pagination
  const limit = 100;
  const { offset, setOffset } = useOffset();

  useSecondaryEffect(() => {
    load();
  }, [offset, limit]);

  async function load() {
    updateURLParams(router, { offset });
    setLoading(true);
    const response = await execApi("get", `/destinations`, {
      limit,
      offset,
    });
    setLoading(false);
    if (response?.destinations) {
      setDestinations(response.destinations);
      setTotal(response.total);

      if (response.total === 0) {
        router.push("/destination/new");
      }
    }
  }

  return (
    <>
      <Head>
        <title>Grouparoo: Destinations</title>
      </Head>

      <h1>Destination</h1>

      <p>{total} destinations</p>

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
            <th>Destination Name</th>
            <th>Group Tracked</th>
            <th>App</th>
            <th>State</th>
            <th>Pending Exports</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          {destinations.map((destination) => {
            const pendingExports =
              destination.exportTotals.created +
              destination.exportTotals.started;

            return (
              <tr key={`destination-${destination.guid}`}>
                <td>
                  <AppIcon src={destination.app?.icon} />
                </td>
                <td>
                  <Link
                    href="/destination/[guid]/edit"
                    as={`/destination/${destination.guid}/edit`}
                  >
                    <a>
                      <strong>
                        {destination.name ||
                          `${destination.state} created on ${
                            new Date(destination.createdAt)
                              .toLocaleString()
                              .split(",")[0]
                          }`}
                      </strong>
                    </a>
                  </Link>
                </td>
                <td>
                  {destination.destinationGroup?.guid ? (
                    <Link
                      href="/group/[guid]/edit"
                      as={`/group/${destination.destinationGroup.guid}/edit`}
                    >
                      <a>{destination.destinationGroup.name}</a>
                    </Link>
                  ) : (
                    "None"
                  )}
                </td>
                <td>
                  <Link
                    href="/app/[guid]/edit"
                    as={`/app/${destination.app.guid}/edit`}
                  >
                    <a>
                      <strong>{destination.app.name}</strong>
                    </a>
                  </Link>
                </td>
                <td>
                  <StateBadge state={destination.state} />
                </td>
                <td>
                  <Badge variant={pendingExports > 0 ? "warning" : "info"}>
                    {pendingExports}
                  </Badge>
                </td>
                <td>
                  <Moment fromNow>{destination.createdAt}</Moment>
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

      <br />
      <Button
        variant="primary"
        onClick={() => {
          router.push("/destination/new");
        }}
      >
        Add new Destination
      </Button>
    </>
  );
}

Page.getInitialProps = async (ctx) => {
  const { execApi } = useApi(ctx);
  const { limit, offset } = ctx.query;
  const { destinations, total } = await execApi("get", `/destinations`, {
    limit,
    offset,
  });
  return { destinations, total };
};
