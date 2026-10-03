export const getRefillErrorMessage = (error) => {
  const message = typeof error?.message === 'string' ? error.message.trim() : '';
  const connectionError = /^(?:TypeError(?::|$)|Network request failed$|Network Error$|Failed to fetch$|fetch failed$|Unable to connect to the Med-Sked server\b|Request failed with status (?:502|503|504)$|(?:service unavailable|gateway timeout)\b)/i;
  const genericError = /^Unable to refill the medication\. Please try again\.?$/i;
  const technicalError = /\bMongo\w*Error\b|\bMongooseError\b|stack trace|\bECONN[A-Z]+\b|\b(?:AxiosError|FetchError|RequestError)\b|(?:^|\n)\s*at\s|(?:[A-Z]:\\|\/(?:Users|home|app|var|tmp)\/)|Bearer\s+\S+|(?:token|secret|api[_ -]?key)\s*[:=]\s*\S+|(?:encryption|cipher|AES|\bIV)\s*[:=]/i;
  const connectionFallback = 'Unable to refill the medication. Please check your connection and try again.';
  const retryFallback = 'Unable to complete the refill. Please try again.';

  if (!message) {
    return retryFallback;
  }

  if (connectionError.test(message)) {
    return connectionFallback;
  }

  if (genericError.test(message) || technicalError.test(message)) {
    return retryFallback;
  }

  return message;
};