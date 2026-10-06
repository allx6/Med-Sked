export const getDoseActionErrorMessage = (error) => {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  const genericError = /^(?:TypeError(?::|$)|Network request failed$|Failed to fetch$|fetch failed$|Unable to connect to the Med-Sked server\b)/i;
  const technicalError = /MongoServerError|MongooseError|stack trace|\bECONN[A-Z]+\b/i;

  if (!message || genericError.test(message) || technicalError.test(message)) {
    return 'Unable to update the dose. Please try again.';
  }

  return message;
};