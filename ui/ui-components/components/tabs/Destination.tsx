import Tabs from "../Tabs";
import { Models } from "../../utils/apiData";
import { useGrouparooModel } from "../../contexts/grouparooModel";
import { grouparooUiEdition } from "../../utils/uiEdition";

export default function DestinationTabs({
  destination,
}: {
  destination: Models.DestinationType;
}) {
  const { model } = useGrouparooModel();

  let tabs = [];
  switch (grouparooUiEdition()) {
    case "enterprise":
      tabs.push("edit");
      if (destination.state !== "draft") tabs.push("data");
      tabs.push("exports", "retry");
      break;
    case "config":
      tabs.push("edit");
      if (destination.state !== "draft") tabs.push("data");
      break;
    default:
      tabs.push("exports", "retry");
      break;
  }

  return (
    <Tabs
      name={destination.name}
      draftType={destination.type}
      tabs={tabs}
      parentNames={[model.name]}
      hideScopeBreadcrumb
    />
  );
}
