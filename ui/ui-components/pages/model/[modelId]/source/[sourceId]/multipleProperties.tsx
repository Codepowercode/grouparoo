import { useApi } from "../../../../../contexts/api";
import { Fragment, useState } from "react";
import { Alert, Row, Col, Table, Form } from "react-bootstrap";
import PageHeader from "../../../../../components/PageHeader";
import StateBadge from "../../../../../components/badges/StateBadge";
import LockedBadge from "../../../../../components/badges/LockedBadge";
import LoadingButton from "../../../../../components/LoadingButton";
import LinkButton from "../../../../../components/LinkButton";
import Link from "next/link";
import SourceTabs from "../../../../../components/tabs/Source";
import Head from "next/head";
import { errorHandler, successHandler } from "../../../../../eventHandlers";
import { Models, Actions } from "../../../../../utils/apiData";
import PropertyAddButton from "../../../../../components/property/Add";
import ModelBadge from "../../../../../components/badges/ModelBadge";
import { ensureMatchingModel } from "../../../../../utils/ensureMatchingModel";
import { generateClient } from "../../../../../client/client";
import { withServerErrorHandler } from "../../../../../utils/withServerErrorHandler";
import { NextPageWithInferredProps } from "../../../../../utils/pageHelper";

export const getServerSideProps = withServerErrorHandler(async (ctx) => {
  const { sourceId, modelId } = ctx.query;
  const client = generateClient(ctx);

  const { source } = await client.request<Actions.SourceView>(
    "get",
    `/source/${sourceId}`
  );
  ensureMatchingModel("Source", source.modelId, modelId.toString());

  const { preview, columnSpeculation } =
    await client.request<Actions.SourcePreview>(
      "get",
      `/source/${sourceId}/preview`
    );
  const { defaultPropertyOptions } =
    await client.request<Actions.SourceDefaultPropertyOptions>(
      "get",
      `/source/${sourceId}/defaultPropertyOptions`
    );
  const { properties } = await client.request<Actions.PropertiesList>(
    "get",
    `/properties`,
    { modelId }
  );
  const { types } = await client.request<Actions.PropertiesOptions>(
    "get",
    `/propertyOptions`
  );

  return {
    props: {
      source,
      properties,
      columnSpeculation,
      preview,
      types,
      defaultPropertyOptions,
    },
  };
});

const Page: NextPageWithInferredProps<typeof getServerSideProps> = ({
  source,
  preview,
  columnSpeculation,
  types,
  defaultPropertyOptions,
  ...props
}) => {
  const { client } = useApi();
  const [properties, setProperties] = useState<Models.PropertyType[]>(
    props.properties
  );
  const primaryOptionKey = defaultPropertyOptions.find(
    (dpo) => dpo.primary === true
  )?.key; // e.g.: "column"
  const optionWithDefaults = defaultPropertyOptions
    .filter((dpo) => dpo.key !== primaryOptionKey)
    .filter((dpo) => dpo.options.find((o) => o.default));
  const optionWithDefaultOptionDefaults = optionWithDefaults.map((dpo) => {
    let defaultOpt = dpo.options.find((o) => o.default);
    return { key: dpo.key, defaultValue: defaultOpt.key };
  });

  async function loadProperties() {
    const response: Actions.PropertiesList = await client.request(
      "get",
      `/properties`
    );
    if (response?.properties) setProperties(response.properties);
  }

  function TableRow({ column }: { column: string }) {
    const [loading, setLoading] = useState(false);

    const defaultOptions: { [key: string]: string } = {};
    defaultPropertyOptions.map((propertyOption) => {
      const defaultOption = propertyOption.options.find((o) => o.default) ??
        propertyOption.options.find((o) => o.key === column) ??
        propertyOption.options[0] ?? { key: "?" };
      defaultOptions[propertyOption.key] = defaultOption.key;
    });

    let exactProperty: Models.PropertyType;
    let otherProperties: Models.PropertyType[] = [];

    for (const property of properties) {
      if (property.sourceId !== source.id) continue;
      if (property.options[primaryOptionKey] !== column) continue;

      let optMatch = true;
      if (property.filters?.length > 0) optMatch = false;

      for (const [key, value] of Object.entries(property.options)) {
        if (key === primaryOptionKey) continue;
        if (!optionWithDefaults.map((dpo) => dpo.key).includes(key)) {
          optMatch = false;
        }
        let defaultValue = optionWithDefaultOptionDefaults.find(
          (o) => o.key === key
        );
        if (defaultValue && defaultValue.defaultValue !== value) {
          optMatch = false;
        }
      }

      if (optMatch) {
        exactProperty = property;
      } else {
        otherProperties.push(property);
      }
    }

    const disabled = exactProperty
      ? exactProperty.sourceId === source.id
      : false;

    const suggestedKey = columnSpeculation[column].suggestedPropertyKey;

    const [key, setKey] = useState(
      exactProperty && exactProperty.sourceId === source.id
        ? exactProperty.key
        : suggestedKey
    );
    const [type, setType] = useState<typeof exactProperty["type"]>(
      exactProperty && exactProperty.sourceId === source.id
        ? exactProperty.type
        : columnSpeculation[column].type
    );
    const [unique, setUnique] = useState(
      exactProperty ? exactProperty.unique : columnSpeculation[column].isUnique
    );

    const hiddenOptions = optionWithDefaults.map((o) => o.key);
    const [options, setOptions] = useState(
      exactProperty && exactProperty.sourceId === source.id
        ? exactProperty.options
        : defaultOptions
    );

    async function createProperty() {
      setLoading(true);
      const response: Actions.PropertyCreate = await client.request(
        "post",
        `/property`,
        {
          sourceId: source.id,
          key,
          type,
          unique,
          options,
          isArray: false,
          state: "ready",
        }
      );
      if (response.property) {
        successHandler.set({ message: "Property Created!" });
        loadProperties();
      } else {
        setLoading(false);
      }
    }

    return (
      <>
        <tr>
          <td>
            <Fragment>
              {Object.keys(options)
                .filter((opt) => !hiddenOptions.includes(opt))
                .sort()
                .map((opt) => (
                  <Form.Group as={Col} key={`opt-${column}-${opt}`}>
                    <strong>
                      <code>{options[opt].toString()}</code>
                    </strong>
                  </Form.Group>
                ))}
            </Fragment>
          </td>
          <td>➡</td>
          <td>
            <Form.Control
              size="sm"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={disabled}
            />
            {!exactProperty && suggestedKey !== column ? (
              <Form.Text
                id="suggestedKeyText"
                muted
              >{`Property with key "${column}" already exists, suggesting "${suggestedKey}" instead.`}</Form.Text>
            ) : null}
          </td>
          <td>
            <Form.Control
              size="sm"
              as="select"
              value={type}
              onChange={(e) =>
                setType(e.target.value as typeof exactProperty["type"])
              }
              disabled={disabled}
            >
              {types.map((v) => (
                <option key={`types-opt-${v}`}>{v}</option>
              ))}
            </Form.Control>
          </td>
          <td>
            <Form.Check
              checked={unique}
              onChange={(e) => setUnique(e.target.checked)}
              disabled={disabled}
            />
          </td>
          <td>
            {exactProperty && exactProperty.sourceId === source.id ? (
              <LinkButton
                variant="outline-info"
                size="sm"
                href={`/model/${source.modelId}/source/${source.id}/property/${exactProperty.id}/edit`}
              >
                View
              </LinkButton>
            ) : (
              <LoadingButton
                size="sm"
                loading={loading}
                onClick={() => createProperty()}
              >
                Create
              </LoadingButton>
            )}
          </td>
        </tr>
        {otherProperties.map((otherProperty) => (
          <tr key={`otherProperty-${otherProperty.id}`}>
            <td style={{ border: 0 }} />
            <td style={{ border: 0 }}>➡</td>
            <td style={{ border: 0 }}>
              <strong>{otherProperty.key}</strong>
            </td>
            <td style={{ border: 0 }} />
            <td style={{ border: 0 }} />
            <td style={{ border: 0 }}>
              <LinkButton
                variant="outline-info"
                size="sm"
                href={`/model/${source.modelId}/source/${source.id}/property/${otherProperty.id}/edit`}
              >
                View
              </LinkButton>
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (!primaryOptionKey) {
    return (
      <>
        <Head>
          <title>Grouparoo: {source.name}</title>
        </Head>

        <SourceTabs source={source} />

        <PageHeader
          icon={source.app.icon}
          title={`${source.name} - Properties`}
          badges={[
            <LockedBadge object={source} />,
            <StateBadge state={source.state} />,
          ]}
        />

        <Alert variant="warning">
          <p>This source does not support quickly adding Properties.</p>

          <PropertyAddButton
            errorHandler={errorHandler}
            successHandler={successHandler}
            source={source}
          />
        </Alert>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Grouparoo: {source.name}</title>
      </Head>

      <SourceTabs source={source} />

      <PageHeader
        icon={source.app.icon}
        title={`${source.name} - Properties`}
        badges={[
          <LockedBadge object={source} />,
          <StateBadge state={source.state} />,
          <ModelBadge modelName={source.modelName} modelId={source.modelId} />,
        ]}
      />

      <h2>
        Quickly Add{" "}
        <code>
          {optionWithDefaultOptionDefaults
            .map((e) => e.defaultValue)
            .join(", ")}
        </code>{" "}
        Properties{" "}
      </h2>

      <p>
        From this page, you can quickly add simple Properties, using default
        options. If you need more control over your Properties, you can create a
        single Property from the{" "}
        <Link href={`/model/${source.modelId}/source/${source.id}/overview`}>
          <a>Source Overview page</a>
        </Link>
        .
      </p>

      <Row>
        <Col>
          <Table>
            <thead>
              <tr>
                <th>Source Column</th>
                <th>{""}</th>
                <th>Key</th>
                <th>Type</th>
                <th>Unique</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {preview[0]
                ? Object.keys(preview[0]).map((column) => (
                    <TableRow key={`column-${column}`} column={column} />
                  ))
                : null}
            </tbody>
          </Table>
        </Col>
      </Row>
    </>
  );
};

export default Page;
