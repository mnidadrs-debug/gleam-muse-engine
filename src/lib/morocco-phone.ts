export const MOROCCO_COUNTRY_CODE = "+212";
export const MOROCCO_LOCAL_PHONE_LENGTH = 9;

export function normalizeMoroccoPhoneInput(rawValue: string) {
  let digits = rawValue.replace(/\D/g, "");

  if (digits.startsWith("212")) {
    digits = digits.slice(3);
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, MOROCCO_LOCAL_PHONE_LENGTH);
}

export function isValidMoroccoPhone(localPhone: string) {
  return new RegExp(`^\\d{${MOROCCO_LOCAL_PHONE_LENGTH}}$`).test(localPhone);
}

export function formatMoroccoPhoneForPayload(localPhone: string) {
  return `${MOROCCO_COUNTRY_CODE}${normalizeMoroccoPhoneInput(localPhone)}`;
}
