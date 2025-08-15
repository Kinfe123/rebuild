export const capitalize = (str: string): string => 
  str.charAt(0).toUpperCase() + str.slice(1);

export const isString = (value: any): value is string => 
  typeof value === 'string';
