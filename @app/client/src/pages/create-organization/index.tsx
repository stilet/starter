import { H3, Redirect, SharedLayout } from "@app/components";
import {
  CreatedOrganizationFragment,
  useCreateOrganizationMutation,
  useOrganizationBySlugLazyQuery,
  useSharedQuery,
} from "@app/graphql";
import {
  extractError,
  formItemLayout,
  getCodeFromError,
  tailFormItemLayout,
} from "@app/lib";
import { Alert, Button, Col, Form, Input, Row, Spin } from "antd";
import { useForm } from "antd/lib/form/util";
import Text from "antd/lib/typography/Text";
import { ApolloError } from "apollo-client";
import { debounce } from "lodash";
import { NextPage } from "next";
import { Store } from "rc-field-form/lib/interface";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import slugify from "slugify";

const CreateOrganizationPage: NextPage = () => {
  const [formError, setFormError] = useState<Error | ApolloError | null>(null);
  const query = useSharedQuery();
  const [form] = useForm();
  const { getFieldValue } = form;
  const slug = slugify(getFieldValue("name") || "", {
    lower: true,
  });
  const [
    lookupOrganizationBySlug,
    { data: existingOrganizationData, loading: slugLoading, error: slugError },
  ] = useOrganizationBySlugLazyQuery();

  const [slugCheckIsValid, setSlugCheckIsValid] = useState(false);
  const checkSlug = useMemo(
    () =>
      debounce(async (slug: string) => {
        try {
          if (slug) {
            await lookupOrganizationBySlug({
              variables: {
                slug,
              },
            });
          }
        } catch (e) {
          /* NOOP */
        } finally {
          setSlugCheckIsValid(true);
        }
      }, 500),
    [lookupOrganizationBySlug]
  );

  useEffect(() => {
    setSlugCheckIsValid(false);
    checkSlug(slug);
  }, [checkSlug, slug]);

  const code = getCodeFromError(formError);
  const [
    organization,
    setOrganization,
  ] = useState<null | CreatedOrganizationFragment>(null);
  const [createOrganization] = useCreateOrganizationMutation();
  const handleSubmit = useCallback(
    async (values: Store) => {
      setFormError(null);
      try {
        const { name } = values;
        const slug = slugify(name || "", {
          lower: true,
        });
        const { data } = await createOrganization({
          variables: {
            name,
            slug,
          },
        });
        setFormError(null);
        setOrganization(data?.createOrganization?.organization || null);
      } catch (e) {
        const errcode = getCodeFromError(e);
        if (errcode === "NUNIQ") {
          form.setFields([
            {
              name: "name",
              value: form.getFieldValue("name"),
              errors: [
                "This organization name is already in use, please pick a different name",
              ],
            },
          ]);
        } else {
          setFormError(e);
        }
      }
    },
    [createOrganization, form]
  );

  if (organization) {
    return <Redirect href={`/o/${organization.slug}`} />;
  }

  return (
    <SharedLayout title="Create Organization" query={query}>
      <Row>
        <Col>
          <h1>Create Organization</h1>
          <div>
            <H3>Edit Profile</H3>
            <Form {...formItemLayout} onFinish={handleSubmit}>
              <Form.Item
                label="Name"
                name="name"
                rules={[
                  {
                    required: true,
                    message: "Please choose a name for the organization",
                  },
                ]}
              >
                <div>
                  <Input />
                  <p>
                    Your organization URL will be{" "}
                    {`${process.env.ROOT_URL}/o/${slug}`}
                  </p>
                  {!slug ? null : !slugCheckIsValid || slugLoading ? (
                    <p>
                      <Spin /> Checking organization name
                    </p>
                  ) : existingOrganizationData?.organizationBySlug ? (
                    <Text type="danger">
                      Organization name is already in use
                    </Text>
                  ) : slugError ? (
                    <Text type="warning">
                      Error occurred checking for existing organization with
                      this name (error code: ERR_{getCodeFromError(slugError)})
                    </Text>
                  ) : null}
                </div>
              </Form.Item>
              {formError ? (
                <Form.Item>
                  <Alert
                    type="error"
                    message={`Creating organization failed`}
                    description={
                      <span>
                        {code === "NUNIQ" ? (
                          <span>
                            That organization name is already in use, please
                            choose a different organization name.
                          </span>
                        ) : (
                          extractError(formError).message
                        )}
                        {code ? (
                          <span>
                            {" "}
                            (Error code: <code>ERR_{code}</code>)
                          </span>
                        ) : null}
                      </span>
                    }
                  />
                </Form.Item>
              ) : null}
              <Form.Item {...tailFormItemLayout}>
                <Button htmlType="submit">Create Organization</Button>
              </Form.Item>
            </Form>
          </div>
        </Col>
      </Row>
    </SharedLayout>
  );
};

export default CreateOrganizationPage;