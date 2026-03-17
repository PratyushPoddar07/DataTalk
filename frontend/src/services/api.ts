import axios, { AxiosInstance } from 'axios';
import type {
  Query,
  DatabaseConnection,
  SchemaInfo,
  QueryRequest
} from '@/types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });

        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }

        // Enhance error message for the UI
        const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred';
        return Promise.reject({ ...error, message: errorMessage });
      }
    );
  }

  // Query endpoints
  executeQuery = async (request: QueryRequest): Promise<Query> => {
    const response = await this.api.post<Query>('/query', request);
    return response.data;
  }

  getQueryHistory = async (databaseId?: number, limit: number = 20): Promise<Query[]> => {
    const params = new URLSearchParams();
    if (databaseId) params.append('database_id', databaseId.toString());
    params.append('limit', limit.toString());

    const response = await this.api.get<Query[]>(`/queries/history?${params}`);
    return response.data;
  }

  // Database endpoints
  getDatabases = async (): Promise<DatabaseConnection[]> => {
    const response = await this.api.get<DatabaseConnection[]>('/databases');
    return response.data;
  }

  createDatabase = async (data: {
    name: string;
    db_type: string;
    connection_string: string;
  }): Promise<DatabaseConnection> => {
    const response = await this.api.post<DatabaseConnection>('/databases', data);
    return response.data;
  }

  getSchema = async (databaseId: number): Promise<SchemaInfo> => {
    const response = await this.api.get<SchemaInfo>(
      `/databases/${databaseId}/schema`
    );
    return response.data;
  }

  deleteDatabase = async (databaseId: number): Promise<{ message: string }> => {
    const response = await this.api.delete(`/databases/${databaseId}`);
    return response.data;
  }

  deleteTable = async (databaseId: number, tableName: string): Promise<{ message: string }> => {
    const response = await this.api.delete(`/databases/${databaseId}/tables/${tableName}`);
    return response.data;
  }

  getTableSample = async (
    databaseId: number,
    tableName: string,
    limit: number = 5
  ): Promise<any> => {
    const response = await this.api.get(
      `/databases/${databaseId}/tables/${tableName}/sample?limit=${limit}`
    );
    return response.data;
  }

  // Health check
  healthCheck = async (): Promise<{ status: string; version: string }> => {
    const response = await this.api.get('/health');
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
