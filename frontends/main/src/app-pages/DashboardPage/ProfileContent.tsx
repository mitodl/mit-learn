"use client"
import React, { useId, useMemo } from "react"
import { useFormik } from "formik"
import { useProfileMeMutation, useProfileMeQuery } from "api/hooks/profile"
import {
  styled,
  CheckboxChoiceBoxField,
  SimpleSelectField,
  Skeleton,
} from "ol-components"
import {
  Button,
  CheckboxChoiceField,
  RadioChoiceField,
  TextField,
  ButtonLoadingIcon,
} from "@mitodl/smoot-design"

import { useLearningResourceTopics } from "api/hooks/learningResources"
import {
  CERTIFICATE_CHOICES,
  EDUCATION_LEVEL_OPTIONS,
  GOALS_CHOICES,
  DELIVERY_CHOICES,
  ProfileSchema,
} from "@/common/profile"
import { useUserMe } from "api/hooks/user"
import { TitleText } from "./HomeContent"

const FormContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  paddingTop: "40px",
  gap: "40px",
  [theme.breakpoints.down("md")]: {
    paddingTop: "24px",
    gap: "32px",
  },
}))

const NameRow = styled.div({
  display: "flex",
  flexDirection: "row",
  gap: "24px",
})

const RadioChoiceFieldStyled = styled(RadioChoiceField)(({ theme }) => ({
  label: {
    color: theme.custom.colors.darkGray2,
    ...theme.typography.subtitle2,
  },
}))

const ButtonContainer = styled.div(({ theme }) => ({
  paddingTop: "18px",
  [theme.breakpoints.down("md")]: {
    paddingTop: "0",
    paddingBottom: "34px",
  },
}))

const UpdateButton = styled(Button)(({ theme }) => ({
  width: "200px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
}))

const ProfileContent: React.FC = () => {
  const formId = useId()
  const { isLoading: isLoadingProfile, data: profile } = useProfileMeQuery()
  const initialFormData = useMemo(() => {
    return {
      ...profile,
      topic_interests:
        profile?.topic_interests?.map((topic) => String(topic.id)) || [],
    }
  }, [profile])
  const { data: user } = useUserMe()

  const { isPending: isSaving, mutateAsync } = useProfileMeMutation()
  const { data: topics } = useLearningResourceTopics({ is_toplevel: true })
  const topicChoices =
    topics?.results?.map((topic) => ({
      label: topic.name,
      value: topic.id.toString(),
    })) ?? []
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: initialFormData ?? ProfileSchema.getDefault(),
    validationSchema: ProfileSchema,
    onSubmit: async (values) => {
      if (formik.dirty) {
        await mutateAsync({
          ...values,
          topic_interests: values.topic_interests.map((id) => parseInt(id)),
        })
      }
    },
    validateOnChange: false,
    validateOnBlur: false,
  })

  if (!profile || isLoadingProfile) {
    return <Skeleton variant="text" width={128} height={32} />
  }

  return (
    <div id="user-profile-edit">
      <TitleText component="h1">Profile</TitleText>
      <form id={formId} onSubmit={formik.handleSubmit}>
        <FormContainer>
          <NameRow>
            <TextField
              label="Full Name"
              name="full_name"
              fullWidth
              value={user?.profile?.name}
              disabled
            />
          </NameRow>
          <CheckboxChoiceBoxField
            name="topic_interests"
            choices={topicChoices}
            label={"What are you interested in learning about?"}
            values={formik.values.topic_interests}
            onChange={formik.handleChange}
            gridProps={{
              justifyContent: "left",
              maxWidth: "lg",
              columns: {
                xl: 12,
                lg: 9,
                md: 6,
                xs: 3,
              },
            }}
            gridItemProps={{ xs: 3 }}
          />
          <CheckboxChoiceField
            name="goals"
            choices={GOALS_CHOICES}
            label={"What are your learning goals?"}
            values={formik.values.goals}
            onChange={formik.handleChange}
          />
          <RadioChoiceFieldStyled
            name="certificate_desired"
            choices={CERTIFICATE_CHOICES}
            label={"Are you seeking a certificate?"}
            value={formik.values.certificate_desired}
            onChange={formik.handleChange}
          />
          <SimpleSelectField
            options={EDUCATION_LEVEL_OPTIONS}
            name="current_education"
            fullWidth
            label={"What is your current level of education?"}
            value={formik.values.current_education}
            onChange={formik.handleChange}
          />
          <CheckboxChoiceField
            name="delivery"
            choices={DELIVERY_CHOICES}
            label={"What course format are you interested in?"}
            values={formik.values.delivery}
            onChange={formik.handleChange}
          />
          <ButtonContainer>
            <UpdateButton
              type="submit"
              size="large"
              variant="primary"
              endIcon={isSaving ? <ButtonLoadingIcon /> : null}
              disabled={!formik.dirty || isSaving}
              form={formId}
            >
              Update
            </UpdateButton>
          </ButtonContainer>
        </FormContainer>
      </form>
    </div>
  )
}

export { ProfileContent }
