// webview-ui/src/services/apiService.ts

import axios, { AxiosInstance, AxiosResponse, AxiosError } from "axios";
import { ApiResponse, ApiError } from "../types"; // Assuming these types are defined in the frontend-specific type definitions
import { logError } from "../utils"; // Assuming a logging utility exists in the frontend utils

// Define a base URL for the API
const API_BASE_URL = "https://api.example.com"; // Replace with the actual API base URL

// Create an Axios instance for API requests
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000, // Set a timeout for requests
  headers: {
    "Content-Type": "application/json",
  },
});

// Function to handle API responses
const handleResponse = <T>(response: AxiosResponse<T>): ApiResponse<T> => {
  return {
    data: response.data,
    status: response.status,
    statusText: response.statusText,
  };
};

// Function to handle API errors
const handleError = (error: AxiosError): ApiError => {
  logError("API Error", error); // Log the error for debugging
  return {
    message: error.message,
    status: error.response?.status || 500,
    statusText: error.response?.statusText || "Internal Server Error",
  };
};

// Example function to get data from the API
export const fetchData = async <T>(
  endpoint: string
): Promise<ApiResponse<T> | ApiError> => {
  try {
    const response = await apiClient.get<T>(endpoint);
    return handleResponse(response);
  } catch (error) {
    return handleError(error as AxiosError);
  }
};

// Example function to post data to the API
export const postData = async <T, U>(
  endpoint: string,
  data: U
): Promise<ApiResponse<T> | ApiError> => {
  try {
    const response = await apiClient.post<T>(endpoint, data);
    return handleResponse(response);
  } catch (error) {
    return handleError(error as AxiosError);
  }
};
