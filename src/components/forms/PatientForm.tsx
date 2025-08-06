"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserFormValidation } from "@/lib/validation";
import { Form, FormField } from "@/components/ui/form";
import { createUser } from "@/lib/actions/patient.actions";
import CustomFormField, { FormFieldType } from "../CustomFormField";
import SubmitButton from "../SubmitButton";
import * as Sentry from "@sentry/nextjs"; //testing the api request latancy

class SentryExampleFrontendError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleFrontendError";
  }
}
const PatientForm = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof UserFormValidation>>({
    resolver: zodResolver(UserFormValidation),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof UserFormValidation>) => {
    setIsLoading(true);
    try {
      const transaction = Sentry.startInactiveSpan({
        name: "Create user to register the patient details.",
      });
      const user = await createUser({
        email: data.email,
        phone: data.phone,
        name: data.name,
      });
      if (user) {
        router.push(`/patients/${user.$id}/register`);
      }
      transaction.end();
    } catch (error) {
      console.log(error);
      throw new SentryExampleFrontendError(
        "This error is raised while creating the user."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="container flex flex-col space-y-4 border-1 rounded-bl-lg rounded-br-lg bg-white-500 w-full space-x-4 p-10"
      >
        <section className="mb-12 space-y-4">
          <h1 className="header">Create Patient</h1>
          <p className="text-dark-700">Get started with appointments.</p>
        </section>

        <CustomFormField
          fieldType={FormFieldType.INPUT}
          control={form.control}
          name="name"
          label="Full name"
          placeholder="John Doe"
          iconSrc="/assets/icons/user.svg"
          iconAlt="user"
        />

        <CustomFormField
          fieldType={FormFieldType.INPUT}
          control={form.control}
          name="email"
          label="Email"
          placeholder="johndoe@gmail.com"
          iconSrc="/assets/icons/email.svg"
          iconAlt="email"
        />

        <CustomFormField
          fieldType={FormFieldType.PHONE_INPUT}
          control={form.control}
          name="phone"
          label="Phone number"
          iconSrc="/assets/icons/user.svg"
          placeholder="(555) 123-4567"
        />
        <div className="flex  sm:ml-[10px] xl:ml-[30px]">
          <SubmitButton isLoading={isLoading}>Get Started</SubmitButton>
        </div>
      </form>
    </Form>
  );
};

export default PatientForm;
