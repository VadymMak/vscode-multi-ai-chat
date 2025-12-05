import axios from "axios";
import logger from "../utils/logger";

const API_BASE_URL = "https://multi-ai-chat-production.up.railway.app/api";

export interface ApiProxyRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  data?: any;
  token?: string;
}

export interface ApiProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

export class ApiProxy {
  static async request(req: ApiProxyRequest): Promise<ApiProxyResponse> {
    try {
      logger.info(`📤 [ApiProxy] ${req.method} ${req.endpoint}`);
      logger.info(`🔍 [ApiProxy] Received data: ${JSON.stringify(req.data)}`);

      const headers: any = {};

      // ✅ SPECIAL HANDLING for /auth/login endpoint (OAuth2 Password Flow)
      if (req.endpoint === "/auth/login") {
        // Validate input data
        if (!req.data || !req.data.username || !req.data.password) {
          logger.error("❌ [ApiProxy] Missing credentials in request data");
          return {
            success: false,
            error: "Username and password are required",
            status: 400,
          };
        }

        // ✅ OAuth2 requires form-urlencoded, NOT JSON!
        headers["Content-Type"] = "application/x-www-form-urlencoded";

        // ✅ Build form data with URLSearchParams
        const formData = new URLSearchParams();
        formData.append("grant_type", "password");
        formData.append("username", req.data.username);
        formData.append("password", req.data.password);

        const fullUrl = `${API_BASE_URL}${req.endpoint}`;
        const formDataString = formData.toString();

        // ✅ DETAILED DEBUG LOGGING
        logger.info(`🔍 [ApiProxy] Full URL: ${fullUrl}`);
        logger.info(`🔍 [ApiProxy] Method: ${req.method}`);
        logger.info(`🔍 [ApiProxy] Headers: ${JSON.stringify(headers)}`);
        logger.info(
          `🔍 [ApiProxy] Form Data: grant_type=password&username=${req.data.username}&password=***`
        );

        try {
          const response = await axios({
            method: req.method,
            url: fullUrl,
            data: formDataString, // ✅ Send as string, not object!
            headers,
            validateStatus: (status) => status < 500,
          });

          logger.info(`📥 [ApiProxy] Response Status: ${response.status}`);
          logger.info(
            `📥 [ApiProxy] Response Data: ${JSON.stringify(response.data)}`
          );

          if (response.status === 200) {
            logger.info(`✅ [ApiProxy] Login successful!`);
          } else {
            logger.error(
              `❌ [ApiProxy] Login failed with status ${response.status}`
            );
          }

          return {
            success: response.status >= 200 && response.status < 300,
            data: response.data,
            status: response.status,
          };
        } catch (error) {
          logger.error(`❌ [ApiProxy] Login request failed:`, error as Error);
          throw error;
        }
      }

      // ✅ SPECIAL HANDLING for /auth/register endpoint
      if (req.endpoint === "/auth/register") {
        // Validate input data
        if (
          !req.data ||
          !req.data.username ||
          !req.data.password ||
          !req.data.email
        ) {
          logger.error("❌ [ApiProxy] Missing registration data");
          return {
            success: false,
            error: "Username, email and password are required",
            status: 400,
          };
        }

        // Registration uses JSON (not form-urlencoded)
        headers["Content-Type"] = "application/json";

        const fullUrl = `${API_BASE_URL}${req.endpoint}`;

        logger.info(`🔍 [ApiProxy] Register URL: ${fullUrl}`);
        logger.info(
          `🔍 [ApiProxy] Register Data: ${JSON.stringify({
            ...req.data,
            password: "***",
          })}`
        );

        try {
          const response = await axios({
            method: req.method,
            url: fullUrl,
            data: req.data,
            headers,
            validateStatus: (status) => status < 500,
          });

          logger.info(
            `📥 [ApiProxy] Register Response Status: ${response.status}`
          );

          return {
            success: response.status >= 200 && response.status < 300,
            data: response.data,
            status: response.status,
          };
        } catch (error) {
          logger.error(
            `❌ [ApiProxy] Register request failed:`,
            error as Error
          );
          throw error;
        }
      }

      // ✅ For all other endpoints, use JSON
      headers["Content-Type"] = "application/json";

      if (req.token) {
        headers.Authorization = `Bearer ${req.token}`;
      }

      const response = await axios({
        method: req.method,
        url: `${API_BASE_URL}${req.endpoint}`,
        data: req.data,
        headers,
      });

      logger.info(`✅ [ApiProxy] Success: ${response.status}`);

      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      let status = 500;
      let errorMessage = "Unknown error";

      if (axios.isAxiosError(error)) {
        status = error.response?.status || 500;
        errorMessage =
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error(`❌ [ApiProxy] Error: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        status,
      };
    }
  }
}
