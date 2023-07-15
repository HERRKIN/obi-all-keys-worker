export interface TwilioResponse {
  body: string;
  num_segments: string;
  direction: string;
  from: string;
  date_updated: string;
  price: null | number;
  error_message: null | string;
  uri: string;
  account_sid: string;
  num_media: string;
  to: string;
  date_created: string;
  status: number;
  sid: string;
  date_sent: null | string;
  messaging_service_sid: null | string;
  error_code: null | string;
  price_unit: string;
  api_version: string;
  subresource_uris: {
    media: string;
  };
}

export interface TwilioError {
  code: number;
  message: string;
  more_info: string;
  status: number;
}
