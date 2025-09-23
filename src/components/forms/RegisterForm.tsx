"use client";
import { zodResolver } from "@hookform/resolvers/zod";

import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Form, FormControl } from "../ui/form";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { SelectItem } from "../ui/select";
import {
  Doctors,
  GenderOptions,
  IdentificationTypes,
  PatientFormDefaultValues,
} from "@/constants/index";
import { registerPatient } from "@/lib/actions/patient.actions";
import { PatientFormValidation } from "@/lib/validation";
import CustomFormField, { FormFieldType } from "../CustomFormField";
import SubmitButton from "../SubmitButton";
import FileUploader from "../FileUploader";
import { consentOptions } from "@/constants/index";
// import * as Sentry from "@sentry/nextjs"; //testing the api request latancy and sending the status for the fetch request.

// class SentryExampleFrontendError extends Error {
//   constructor(message: string | undefined) {
//     super(message);
//     this.name = "SentryExampleFrontendError";
//   }
// }

type User = {
  $id: string;
  name: string;
  email: string;
  phone: string;
};

const RegisterForm = ({ user }: { user: User }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm({
    resolver: zodResolver(PatientFormValidation),
    defaultValues: {
      ...PatientFormDefaultValues,

      name: user?.name,
      email: user?.email,
      phone: user?.phone,
    },
  });

  const onSubmit = async (data: z.infer<typeof PatientFormValidation>) => {
    setIsLoading(true);
    let formData = new FormData();
    if (
      data.identificationDocument &&
      data.identificationDocument?.length > 0
    ) {
      const blobFile = new Blob([data.identificationDocument[0]], {
        type: data.identificationDocument[0].type,
      });

      formData.append("blobFile", blobFile);
      formData.append("fileName", data.identificationDocument[0].name);
    }

    data.privacyConsent.forEach((consent: string) => {
      formData.append("privacyConsent[]", consent);
    });
    try {
      // const userData = await Sentry.startSpan(
      //   {
      //     name: `fetch-user-data-${user.$id}`,
      //     op: "http.request.create",
      //     attributes: { routr: `GET /users/${user.name}` },
      //   },
      //   async (span) => {
      //     console.log(
      //       `Inside fetchUserData span callback for user ${user.$id}.`
      //     );
      //     span.setAttribute("userId", user.$id); // Add custom data to the span

      //     // Simulate network delay
      //     await new Promise((resolve) => setTimeout(resolve, 500));
      //     const transaction = Sentry.startInactiveSpan({
      //       name: "Create Data Operation in RegisterForm",
      //     });
      const patient = {
        userId: user.$id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        birthDate: new Date(data.birthDate),
        gender: data.gender,
        address: data.address,
        occupation: data.occupation ?? "",
        emergencyContactName: data.emergencyContactName ?? "",
        emergencyContactNumber: data.emergencyContactNumber ?? "",
        primaryPhysician: data.primaryPhysician ?? "",
        insuranceProvider: data.insuranceProvider ?? "",
        insurancePolicyNumber: data.insurancePolicyNumber ?? "",
        allergies: data.allergies ?? "",
        currentMedication: data.currentMedication ?? "",
        familyMedicalHistory: data.familyMedicalHistory ?? "",
        pastMedicalHistory: data.pastMedicalHistory ?? "",
        identificationType:
          data.identificationType?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "",
        identificationNumber: data.identificationNumber ?? "",
        identificationDocument: data.identificationDocument
          ? formData
          : undefined,
        privacyConsent: data.privacyConsent ? formData : undefined,
      };

      const newPatient = await registerPatient(patient);
      if (newPatient) {
        router.push(`/patients/${user.$id}/new-appointment`);
      }
      console.log(`Register data for user ${newPatient.$id}:`, newPatient.name);
      // span.setStatus(newPatient);
      // transaction.end();
    } catch (error) {
      console.log(error);
      // throw new SentryExampleFrontendError(
      //   "This error is raised while register the patient details."
      // );
    }
    setIsLoading(false);
  };

  return (
    <Form {...form}>
      <form className=" space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col border-1 rounded-lg h-[500] overflow-y-auto p-5 gap-4">
          <section className="space-y-6 sm:w-full sm:justify-center border-1 rounded-lg p-5 overflow-y-auto overflow-x-hidden flex-1">
            <div className="mb-2 space-y-1">
              <h2 className="sub-header">Personal Information</h2>
            </div>
            {/* NAME */}
            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="name"
              label="Full name"
              placeholder="John Doe"
              iconSrc="/assets/icons/user.svg"
              iconAlt="user"
            />

            {/* EMAIL & PHONE */}
            <div className="flex flex-col gap-6 xl:flex-row">
              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="email"
                label="Email address"
                placeholder="johndoe@gmail.com"
                iconSrc="/assets/icons/email.svg"
                iconAlt="email"
              />

              <CustomFormField
                fieldType={FormFieldType.PHONE_INPUT}
                control={form.control}
                name="phone"
                label="Phone Number"
                placeholder="(555) 123-4567"
              />
            </div>

            {/* BirthDate & Gender */}
            <div className="flex flex-col gap-[0%] xl:flex-row ">
              <CustomFormField
                fieldType={FormFieldType.DATE_PICKER}
                control={form.control}
                name="birthDate"
                label="Date of birth"
                showTimeSelect={true}
                placeholder={new Date().toString()}
              />
              <CustomFormField
                fieldType={FormFieldType.SKELETON}
                control={form.control}
                name="gender"
                label="Gender"
                renderSkeleton={(field: any) => (
                  <FormControl>
                    <RadioGroup
                      className="flex h-11 gap-6 xl:justify-between"
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      {GenderOptions.map((option, i) => (
                        <div key={option + i} className="radio-group">
                          <RadioGroupItem value={option} id={option} />
                          <Label htmlFor={option} className="cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}
              />
            </div>
            {/* Address & Occupation */}
            <div className="flex flex-col xl:flex-row gap-6">
              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="address"
                label="Address"
                placeholder="14 street, New york, NY - 5101"
                iconSrc="/assets/icons/email.svg"
                iconAlt="address"
              />

              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="occupation"
                label="Occupation"
                placeholder=" Software Engineer"
                iconSrc="/assets/icons/email.svg"
                iconAlt="occupation"
              />
            </div>
            {/* Emergency Contact Name & Emergency Contact Number */}
            <div className="flex flex-col gap-6 xl:flex-row">
              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="emergencyContactName"
                label="Emergency contact name"
                placeholder="Guardian's name"
                iconSrc="/assets/icons/email.svg"
                iconAlt="emergency name"
              />

              <CustomFormField
                fieldType={FormFieldType.PHONE_INPUT}
                control={form.control}
                name="emergencyContactNumber"
                label="Emergency contact number"
                placeholder="(555) 123-4567"
                iconSrc="/assets/icons/email.svg"
                iconAlt="emergency number"
              />
            </div>
          </section>
          <section className="space-y-6 sm:w-full sm:justify-center border-1 rounded-lg p-5 overflow-y-auto overflow-x-hidden flex-1">
            <div className="mb-2 space-y-2">
              <h2 className="sub-header">Medical Information</h2>
            </div>
            <CustomFormField
              fieldType={FormFieldType.SELECT}
              control={form.control}
              name="primaryPhysician"
              label="Primary care physician"
              placeholder="Select a physician"
            >
              {Doctors.map((doctor, i) => (
                <SelectItem key={doctor.name + i} value={doctor.name}>
                  <div className="flex cursor-pointer items-center  gap-2 w-fit h-fit">
                    <Image
                      src={doctor.image}
                      alt={doctor.name}
                      width={30}
                      height={30}
                      fill
                      className="rounded-full border border-dark-500 h-8"
                    />
                    <p>{doctor.name}</p>
                  </div>
                </SelectItem>
              ))}
            </CustomFormField>

            {/* INSURANCE & POLICY NUMBER */}
            <div className="flex container flex-col gap-6 xl:flex-row">
              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="insuranceProvider"
                label="Insurance provider"
                placeholder="BlueCross BlueShield"
              />

              <CustomFormField
                fieldType={FormFieldType.INPUT}
                control={form.control}
                name="insurancePolicyNumber"
                label="Insurance policy number"
                placeholder="ABC123456789"
              />
            </div>
            {/* ALLERGY & CURRENT MEDICATIONS */}
            <div className="flex container flex-col gap-6 xl:flex-row">
              <CustomFormField
                fieldType={FormFieldType.TEXTAREA}
                control={form.control}
                name="allergies"
                label="Allergies (if any)"
                placeholder="Peanuts, Penicillin, Pollen"
              />

              <CustomFormField
                fieldType={FormFieldType.TEXTAREA}
                control={form.control}
                name="currentMedication"
                label="Current medications"
                placeholder="Ibuprofen 200mg, Levothyroxine 50mcg"
              />
            </div>
            {/* FAMILY MEDICATION & PAST MEDICATIONS */}
            <div className="flex flex-col gap-6 xl:flex-row">
              <CustomFormField
                fieldType={FormFieldType.TEXTAREA}
                control={form.control}
                name="familyMedicalHistory"
                label=" Family medical history (if relevant)"
                placeholder="Mother had brain cancer, Father has hypertension"
              />

              <CustomFormField
                fieldType={FormFieldType.TEXTAREA}
                control={form.control}
                name="pastMedicalHistory"
                label="Past medical history"
                placeholder="Appendectomy in 2015, Asthma diagnosis in childhood"
              />
            </div>
          </section>
          <section className="space-y-6 sm:w-full sm:justify-center border-1 rounded-lg p-5 overflow-y-auto overflow-x-hidden flex-1">
            <div className="mb-9 space-y-1">
              <h2 className="sub-header">Identification and Verfication</h2>
            </div>
            <CustomFormField
              fieldType={FormFieldType.SELECT}
              control={form.control}
              name="identificationType"
              label="Identification Type"
              placeholder="Select identification type"
            >
              {IdentificationTypes.map((type, i) => (
                <SelectItem key={type + i} value={type}>
                  {type}
                </SelectItem>
              ))}
            </CustomFormField>
            <CustomFormField
              fieldType={FormFieldType.INPUT}
              control={form.control}
              name="identificationNumber"
              label="Identification Number"
              placeholder="123456789"
            />
            <CustomFormField
              fieldType={FormFieldType.SKELETON}
              control={form.control}
              name="identificationDocument"
              label="Scanned Copy of Identification Document"
              renderSkeleton={(field) => (
                <FormControl>
                  <FileUploader files={field.value} onChange={field.onChange} />
                </FormControl>
              )}
            />
          </section>
          <section className="container space-y-6 sm:w-full sm:justify-center border-1 rounded-lg p-5 overflow-y-auto w-full flex-1">
            <div className="mb-9 space-y-1">
              <h2 className="sub-header">Consent and Privacy</h2>
            </div>

            {/*
          This is your multiple checkbox group.
          All three consents are now options within ONE `privacyConsent` field.
        */}
            <CustomFormField
              fieldType={FormFieldType.CHECKBOX_GROUP}
              control={form.control}
              name="privacyConsent" // This name holds the array of selected consent values
              label="Please select all applicable consents:"
              description="You must agree to at least one consent."
              options={consentOptions} // Pass the array of consent options
            />
          </section>
          <div className="flex justify-center cursor-pointer">
            <SubmitButton isLoading={isLoading}>
              Submit and Continue
            </SubmitButton>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default RegisterForm;
