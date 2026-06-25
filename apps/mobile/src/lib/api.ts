/**
 * Nara API Client
 * Handles all communication with the backend REST API.
 * Attaches Supabase JWT to all protected requests.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { supabase } from './supabase';
// ApiError from @nara/shared is the *response body* shape { error: { code, message } }.
// We import it only as a type to avoid name collisions with our local class below.
import type { ApiError as ApiErrorBody } from '@nara/shared';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add JWT to all requests
    this.client.interceptors.request.use(async (config) => {
      try {
        // Get the current session from Supabase
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        // Silently fail if token retrieval fails
        console.error('Failed to get auth token:', error);
      }
      return config;
    });

    // Handle errors — parse the standard { error: { code, message } } shape
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiErrorBody>) => {
        if (error.response?.data?.error) {
          const apiError = new NaraApiError(
            error.response.data.error.message,
            error.response.data.error.code,
            error.response.status
          );
          return Promise.reject(apiError);
        }
        throw error;
      }
    );
  }

  get<T>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  delete<T>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const api = new ApiClient();

/** Runtime error class thrown by the API client for structured API errors. */
export class NaraApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number
  ) {
    super(message);
    this.name = 'NaraApiError';
  }
}

// Backwards-compatible alias so existing catch blocks work unchanged
export { NaraApiError as ApiError };
