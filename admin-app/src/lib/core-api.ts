import axios from "axios";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const DEFAULT_CORE_API_URL = "http://localhost:3333";
const DEFAULT_MINIO_UPLOAD_HOST = "localhost";

type CoreApiOptions = {
  requireToken?: boolean;
};

export function getCoreApiBaseUrl() {
  return process.env.CORE_API_URL?.trim() || DEFAULT_CORE_API_URL;
}

export function getMinioUploadHost() {
  return process.env.MINIO_UPLOAD_HOST?.trim() || DEFAULT_MINIO_UPLOAD_HOST;
}

export async function getCoreApi(options: CoreApiOptions = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (options.requireToken && !token) {
    redirect("/login");
  }

  return axios.create({
    baseURL: getCoreApiBaseUrl(),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
