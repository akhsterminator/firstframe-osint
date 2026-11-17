import { customAlphabet } from "nanoid";

// No lookalike characters, so IDs survive being read off a screenshot.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
export const reportId = customAlphabet(alphabet, 10);
export const shortId = customAlphabet(alphabet, 6);
