declare module "react-phone-number-input/style.css";
declare module "react-datepicker/dist/react-datepicker.css";

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}