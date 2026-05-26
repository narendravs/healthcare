declare module "pdf-parse-fixed" {
  function pdf(dataBuffer: Buffer, options?: any): Promise<any>;
  export = pdf;
}
