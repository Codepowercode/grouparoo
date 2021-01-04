import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, Table, ProgressBar } from "react-bootstrap";
import { Models, Actions } from "../../utils/apiData";
import { useRealtimeModelStream } from "../../hooks/useRealtimeModelStream";
import Moment from "react-moment";
import RollingChart from "./rollingChart";

const TIMEOUT = 5 * 1000;
const maxSampleLength = 20;

export function BigNumber({ execApi, model, title, href = null }) {
  const [total, setTotal] = useState<number>(null);
  let timer;

  useEffect(() => {
    startTimer();

    return () => {
      clearInterval(timer);
    };
  }, []);

  function startTimer() {
    load();
    timer = setInterval(load, TIMEOUT);
  }

  async function load() {
    const { total }: Actions.TotalsAction = await execApi("get", `/totals`, {
      model,
    });

    if (total) setTotal(total);
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>
          {href ? (
            <Link href={href}>
              <a>{title}</a>
            </Link>
          ) : (
            title
          )}
        </Card.Title>
        <span style={{ fontSize: 25 }}>{total ? total : "..."}</span>
      </Card.Body>
    </Card>
  );
}

export function GroupsByNewestMember({ execApi }) {
  const [groups, setGroups] = useState<Models.GroupType[]>([]);
  const [newestMembersAdded, setNewestMembersAdded] = useState<{
    [guid: string]: number;
  }>({});

  let timer;

  useEffect(() => {
    startTimer();

    return () => {
      clearInterval(timer);
    };
  }, []);

  function startTimer() {
    load();
    timer = setInterval(load, TIMEOUT);
  }

  async function load() {
    const {
      groups,
      newestMembersAdded,
    }: Actions.GroupsListByNewestMember = await execApi(
      "get",
      `/groups/byNewestMember`
    );

    if (groups) setGroups(groups);
    if (newestMembersAdded) setNewestMembersAdded(newestMembersAdded);
  }

  if (groups.length === 0)
    return (
      <Card>
        <Card.Body>No Groups</Card.Body>
      </Card>
    );

  return (
    <Card>
      <Card.Body>
        <Table size={"sm"}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Profiles</th>
              <th>Newest Member Added</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              return (
                <tr key={`group-${group.guid}`}>
                  <td>
                    {group.type === "calculated" ? (
                      <Link
                        href="/group/[guid]/rules"
                        as={`/group/${group.guid}/rules`}
                      >
                        <a>{group.name}</a>
                      </Link>
                    ) : (
                      <Link
                        href="/group/[guid]/edit"
                        as={`/group/${group.guid}/edit`}
                      >
                        <a>{group.name}</a>
                      </Link>
                    )}
                  </td>
                  <td>{group.profilesCount}</td>
                  <td>
                    {newestMembersAdded[group.guid] ? (
                      <Moment fromNow>{newestMembersAdded[group.guid]}</Moment>
                    ) : (
                      "No Group Members"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <br />
        <Link href="/groups">
          <a>See all Groups</a>
        </Link>
      </Card.Body>
    </Card>
  );
}

export function RunningRuns({ execApi }) {
  useRealtimeModelStream("run", "totals-runs-list", load);
  const [runs, setRuns] = useState<Models.RunType[]>([]);
  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { runs }: Actions.RunsList = await execApi("get", `/runs`, {
      state: "running",
    });

    if (runs) setRuns(runs);
  }

  if (runs.length === 0) {
    return (
      <Card>
        <Card.Body>No Active Runs</Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>Active Runs</Card.Title>
        <Table size="sm">
          <thead>
            <tr>
              <th>Creator</th>
              <th>High Water Mark</th>
              <th>Percent Complete</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const higWaterMarkCollection =
                run.highWaterMark || run.groupHighWaterMark;
              const highWaterMark = higWaterMarkCollection
                ? Object.values(higWaterMarkCollection)[0]
                : "n/a";

              return (
                <tr key={`run-${run.guid}`}>
                  <td>
                    <Link href="/run/[guid]/edit" as={`/run/${run.guid}/edit`}>
                      <a>
                        {run.creatorType}: {run.creatorName}
                      </a>
                    </Link>
                  </td>
                  <td>{highWaterMark}</td>
                  <td>
                    <ProgressBar
                      variant="info"
                      style={{ minWidth: 300 }}
                      animated={run.percentComplete > 0 ? true : false}
                      now={run.percentComplete}
                      label={`${run.percentComplete}%`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

export function ScheduleRuns({ execApi }) {
  const [sources, setSources] = useState<Models.SourceType[]>([]);
  const [runs, setRuns] = useState<{ [guid: string]: Models.RunType }>({});

  let timer;

  useEffect(() => {
    startTimer();

    return () => {
      clearInterval(timer);
    };
  }, []);

  function startTimer() {
    load();
    timer = setInterval(load, TIMEOUT);
  }

  async function load() {
    const { sources }: Actions.SourcesList = await execApi("get", `/sources`);
    if (!sources) return;

    const sourcesWithSchedules = sources.filter(
      (source) => source?.schedule?.recurring
    );

    const runs = {};
    await Promise.all(
      sourcesWithSchedules.map(async (source) => {
        const run = await loadRun(source);
        runs[source.guid] = run;
      })
    );

    setSources(sourcesWithSchedules);
    setRuns(runs);
  }

  async function loadRun(source: Models.SourceType) {
    const { runs }: { runs: Models.RunType[] } = await execApi(
      "get",
      `/runs`,
      {
        guid: source.schedule.guid,
        limit: 1,
      },
      null,
      null,
      false
    );
    return runs[0];
  }

  if (sources.length === 0) {
    return (
      <Card>
        <Card.Body>No Recurring Schedules</Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>Schedules</Card.Title>
        <Table size="sm">
          <thead>
            <tr>
              <th>Schedule</th>
              <th>Next Run</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => {
              const run = runs[source.guid];
              const recurringFrequencyMinutes =
                source.schedule.recurringFrequency / (60 * 1000);

              return (
                <tr key={`source-${source.guid}`}>
                  <td>
                    <Link
                      href="/source/[guid]/schedule"
                      as={`/source/${source.guid}/schedule`}
                    >
                      <a>{source.name}</a>
                    </Link>
                  </td>
                  <td>
                    {run?.updatedAt &&
                    new Date(run.updatedAt).getTime() +
                      source.schedule.recurringFrequency >
                      new Date().getTime() &&
                    recurringFrequencyMinutes > 0 ? (
                      <>
                        in{" "}
                        <Moment
                          add={{
                            minutes: recurringFrequencyMinutes,
                          }}
                          toNow
                          ago
                        >
                          {run.updatedAt}
                        </Moment>
                      </>
                    ) : null}

                    {(run?.updatedAt &&
                      new Date(run.updatedAt).getTime() +
                        source.schedule.recurringFrequency <=
                        new Date().getTime() &&
                      recurringFrequencyMinutes) ||
                    !run ? (
                      source.schedule.recurring ? (
                        <strong>Soon</strong>
                      ) : (
                        "N/A"
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

const pendingImportSamples = [];
export function PendingImports({ execApi }) {
  const [sources, setSources] = useState<Models.SourceType[]>([]);
  const [pendingProfilesCount, setPendingProfilesCount] = useState(0);
  const [mostRecentImport, setMostRecentImport] = useState<Models.ImportType>();
  let timer;

  useEffect(() => {
    startTimer();

    return () => {
      clearInterval(timer);
    };
  }, []);

  function startTimer() {
    load();
    timer = setInterval(load, TIMEOUT);
  }

  async function load() {
    const { sources }: Actions.SourcesList = await execApi("get", `/sources`, {
      state: "ready",
    });

    const {
      total: _pendingProfilesCount,
    }: Actions.ProfilesList = await execApi("get", "/profiles", {
      state: "pending",
      limit: 1,
    });

    const { counts }: Actions.SourcesCountPending = await execApi(
      "get",
      `/sources/countPending`
    );

    const { imports }: Actions.ImportsList = await execApi("get", "/imports", {
      limit: 1,
    });

    const sample = { time: new Date() };
    for (const i in sources) {
      const source = sources[i];
      sample[source.name] = counts[source.guid] || 0;
    }

    pendingImportSamples.push(sample);
    if (pendingImportSamples.length > maxSampleLength) {
      pendingImportSamples.shift();
    }

    if (sources) setSources(sources);
    if (imports) setMostRecentImport(imports[0]);
    if (_pendingProfilesCount !== undefined) {
      setPendingProfilesCount(_pendingProfilesCount);
    }
  }

  if (sources.length === 0) {
    return (
      <Card>
        <Card.Body>No Sources</Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>Pending Profiles ({pendingProfilesCount})</Card.Title>
        <div style={{ height: 200 }}>
          <RollingChart
            data={pendingImportSamples}
            keys={sources.map((d) => d.name)}
          />
        </div>
        Most Recent Import:{" "}
        {mostRecentImport ? (
          <Moment fromNow>{mostRecentImport.createdAt}</Moment>
        ) : (
          "Never"
        )}
      </Card.Body>
    </Card>
  );
}

const pendingExportSamples = [];
export function PendingExports({ execApi }) {
  const [destinations, setDestinations] = useState<Models.DestinationType[]>(
    []
  );
  const [pendingExportsCount, setPendingExportsCount] = useState(0);
  const [mostRecentExport, setMostRecentExport] = useState<Models.ExportType>();
  let timer;

  useEffect(() => {
    startTimer();

    return () => {
      clearInterval(timer);
    };
  }, []);

  function startTimer() {
    load();
    timer = setInterval(load, TIMEOUT);
  }

  async function load() {
    const { destinations }: Actions.DestinationsList = await execApi(
      "get",
      `/destinations`
    );

    const { exports: _exports }: Actions.ExportsList = await execApi(
      "get",
      "/exports",
      { limit: 1 }
    );

    let _pendingExportsCount = 0;
    const sample = { time: new Date() };
    for (const i in destinations) {
      const destination = destinations[i];
      sample[destination.name] =
        destination.exportTotals.created + destination.exportTotals.started;
      _pendingExportsCount +=
        destination.exportTotals.created + destination.exportTotals.started;
    }

    pendingExportSamples.push(sample);
    if (pendingExportSamples.length > maxSampleLength) {
      pendingExportSamples.shift();
    }

    if (destinations) setDestinations(destinations);
    if (_exports) setMostRecentExport(_exports[0]);
    if (destinations) setPendingExportsCount(_pendingExportsCount);
  }

  if (destinations.length === 0) {
    return (
      <Card>
        <Card.Body>No Destinations</Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Body>
        <Card.Title>Pending Exports ({pendingExportsCount})</Card.Title>
        <div style={{ height: 200 }}>
          <RollingChart
            data={pendingExportSamples}
            keys={destinations.map((d) => d.name)}
          />
        </div>
        Most Recent Export:{" "}
        {mostRecentExport ? (
          <Moment fromNow>{mostRecentExport.createdAt}</Moment>
        ) : (
          "Never"
        )}
      </Card.Body>
    </Card>
  );
}