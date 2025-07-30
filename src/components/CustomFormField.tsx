import React from "react";
import { Control } from "react-hook-form";
import Image from "next/image";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Select, SelectContent, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Checkbox } from "./ui/checkbox";
import { ConsentOption } from "../types/index"; // Import your types and options
import { CustomDateTimePicker } from "./CustomeDateTimePicker";

export enum FormFieldType {
  INPUT = "input",
  TEXTAREA = "textarea",
  PHONE_INPUT = "phoneInput",
  CHECKBOX = "checkbox",
  DATE_PICKER = "datePicker",
  SELECT = "select",
  SKELETON = "skeleton",
  CHECKBOX_GROUP = "checkboxGroup",
}

interface CustomProps {
  control: Control<any>;
  name: string;
  label: string;
  placeholder?: string;
  iconSrc?: string;
  iconAlt?: string;
  disabled?: boolean;
  readOnly?: boolean;
  dateFormat?: string;
  showTimeSelect?: boolean;
  children?: React.ReactNode;
  renderSkeleton?: (field: any) => React.ReactNode;
  fieldType: FormFieldType;
  // For CHECKBOX_GROUP, you'll pass the options
  options?: ConsentOption[];
  description?: string;
  onChange?: (value: any) => void; // Optional onChange handler for SELECT
}

const RenderInput = ({ field, props }: { field: any; props: CustomProps }) => {
  switch (props.fieldType) {
    case FormFieldType.INPUT:
      return (
        <div className="flex items-center ">
          {props.iconSrc && (
            <Image
              src={props.iconSrc}
              alt={props.iconAlt || "icon"}
              width={24}
              height={24}
              className="ml-2"
            />
          )}
          <FormControl>
            <input
              {...field}
              type="text"
              placeholder={props.placeholder}
              className="shad-input border-0"
            />
          </FormControl>
        </div>
      );
    case FormFieldType.TEXTAREA:
      return (
        <FormControl>
          <Textarea
            {...field}
            placeholder={props.placeholder}
            className="shad-textArea "
            disabled={props.disabled}
          />
        </FormControl>
      );
    case FormFieldType.PHONE_INPUT:
      return (
        <div className="flex items-center justify-content-center ">
          {props.iconSrc && (
            <Image
              src={props.iconSrc}
              alt={props.iconAlt || "icon"}
              width={24}
              height={24}
              className="ml-2"
              priority
            />
          )}
          <FormControl>
            <PhoneInput
              type="tel"
              placeholder={props.placeholder}
              defaultCountry="US"
              international
              withCountryCallingCode
              value={field.value}
              onChange={field.onChange}
              className=" shad-input lg:w-[350px]"
            />
          </FormControl>
        </div>
      );
    case FormFieldType.CHECKBOX:
      return (
        <div className="flex items-center gap-4 ">
          <FormControl>
            <Checkbox
              id={props.name}
              checked={field.value}
              onCheckedChange={field.onChange}
              className="shad-checkbox"
              {...field}
            />
          </FormControl>
          <label htmlFor={props.name} className="checkbox-label">
            {props.label}
          </label>
        </div>
      );
    case FormFieldType.CHECKBOX_GROUP:
      return (
        <div className="flex flex-col space-y-2 ">
          {props.options?.map((option: ConsentOption) => (
            <FormItem
              key={option.value}
              className="flex flex-row  space-x-3 space-y-0 items-center justify-content-center"
            >
              <FormControl>
                <Checkbox
                  checked={field.value?.includes(option.value)}
                  onCheckedChange={(checked) => {
                    // This logic updates the array held by the form field
                    return checked
                      ? field.onChange([...(field.value || []), option.value])
                      : field.onChange(
                          field.value?.filter(
                            (value: string) => value !== option.value
                          )
                        );
                  }}
                  disabled={field.disabled}
                  className="shad-checkbox "
                />
              </FormControl>

              <FormLabel className="checkbox-label">{option.label}</FormLabel>
            </FormItem>
          ))}
        </div>
      );
    case FormFieldType.DATE_PICKER:
      return (
        <div className="flex">
          <Image
            src="/assets/icons/calendar.svg"
            height={24}
            width={24}
            alt="user"
            className="ml-2"
          />
          <FormControl>
            <CustomDateTimePicker
              value={field.value}
              onChange={field.onChange}
              disabled={field.disabled}
            />
          </FormControl>
        </div>
      );
    case FormFieldType.SELECT:
      return (
        <FormControl>
          <Select
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              if (props.onChange) props.onChange(value);
            }}
          >
            <FormControl>
              <SelectTrigger className="shad-select-trigger w-fit">
                <SelectValue placeholder={props.placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="shad-select-content w-fit">
              {props.children}
            </SelectContent>
          </Select>
        </FormControl>
      );
    case FormFieldType.SKELETON:
      return props.renderSkeleton ? props.renderSkeleton(field) : null;
    default:
      return null;
  }
};

const CustomFormField = (props: CustomProps) => {
  const { control, name, label } = props;
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {props.fieldType !== FormFieldType.CHECKBOX && label && (
            <FormLabel>{label}</FormLabel>
          )}

          {props.description && (
            <FormDescription className="font-medium py-2 text-weight-500">
              {props.description}
            </FormDescription>
          )}
          <RenderInput field={field} props={props} />
          <FormMessage className="form-error-message" />
        </FormItem>
      )}
    ></FormField>
  );
};

export default CustomFormField;
