import slugify from "slugify";

export const generateSlug = (text) => {
  return slugify(text, {
    lower: true,
    strict: true,
    locale: "vi",
  });
};