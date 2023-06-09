import { useCallback, useEffect, useMemo, useState } from "react";
import SampleRecordCard, {
  SampleRecordCardProps,
} from "../record/SampleRecordCard";
import { Actions, Models } from "../../utils/apiData";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useApi } from "../../contexts/api";
import { useGrouparooModel } from "../../contexts/grouparooModel";
import { DestinationMappingOptionsMethodResponse } from "@grouparoo/core";

interface Props {
  destination: Models.DestinationType;
  collection: Models.DestinationType["collection"];
  groupId: string;
  mappingOptions: DestinationMappingOptionsMethodResponse;
  destinationDirty: boolean;
}

type SampleRecordOmittedProps = Omit<
  SampleRecordCardProps,
  | "fetchRecord"
  | "groupsTitle"
  | "propertiesTitle"
  | "propertyLinkDisabled"
  | "importDisabled"
>;

const DestinationSampleRecord: React.FC<Props & SampleRecordOmittedProps> = ({
  destination,
  mappingOptions,
  groupId,
  collection,
  destinationDirty,
  ...props
}) => {
  const {
    model: { id: modelId },
  } = useGrouparooModel();
  const { client } = useApi();
  const debouncedDestination = useDebouncedValue(destination, 1000);
  const [warning, setWarning] = useState<string>();

  const reloadKey = useMemo(
    () =>
      JSON.stringify([
        groupId,
        collection,
        debouncedDestination.id,
        debouncedDestination.group,
        debouncedDestination.mapping,
        debouncedDestination.destinationGroupMemberships,
        warning,
      ]),
    [
      groupId,
      collection,
      debouncedDestination.id,
      debouncedDestination.group,
      debouncedDestination.mapping,
      debouncedDestination.destinationGroupMemberships,
      warning,
    ]
  );
  const fetchRecord = useCallback<SampleRecordCardProps["fetchRecord"]>(
    async (recordId: string) => {
      const destinationGroupMemberships: Record<string, string> =
        debouncedDestination.destinationGroupMemberships.reduce((acc, dgm) => {
          acc[dgm.groupId] = dgm.remoteKey;
          return acc;
        }, {} as Record<string, string>);

      const response = await client.request<Actions.DestinationRecordPreview>(
        "get",
        `/destination/${debouncedDestination.id}/recordPreview`,
        {
          groupId,
          modelId,
          collection,
          mapping: debouncedDestination.mapping,
          destinationGroupMemberships,
          recordId,
        }
      );

      let warning: string;

      if (collection === "none") {
        warning =
          "This Grouparoo Record will not be part of the export to the Destination because no Model or Group is selected.";
      } else if (
        collection === "group" &&
        groupId &&
        (!response.record || !response.record.groupIds.includes(groupId))
      ) {
        warning = `
          This Grouparoo Record will not be sent to the Destination because it‘s not in the selected Group.
          You can switch to a random Record to get one that will export.
        `;
      }

      setWarning(warning);

      return response;
    },
    [
      debouncedDestination.destinationGroupMemberships,
      debouncedDestination.id,
      debouncedDestination.mapping,
      client,
      groupId,
      modelId,
      collection,
    ]
  );

  useEffect(() => {
    const dirtyDestinationWarning =
      "You need to save this destination to export it.";
    if (destinationDirty && !warning) {
      setWarning(dirtyDestinationWarning);
    } else if (!destinationDirty && warning === dirtyDestinationWarning) {
      setWarning("");
    }
  }, [destinationDirty, warning]);

  return (
    <SampleRecordCard
      {...props}
      reloadKey={reloadKey}
      fetchRecord={fetchRecord}
      propertiesTitle={mappingOptions?.labels?.property?.plural}
      groupsTitle={mappingOptions?.labels?.group?.plural}
      warning={warning}
      propertyLinkDisabled
      importDisabled
      randomRecordDisabled={collection === "none"}
      groupId={groupId}
    />
  );
};

export default DestinationSampleRecord;
