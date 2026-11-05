import axios from "axios";
import { getCoreApiBaseUrl } from "@/lib/core-api";

export async function auth(cpf: string, password: string) {
  const { data } = await axios.post(`${getCoreApiBaseUrl()}/admin/auth`, {
    cpf,
    password,
  });

  return data;
}
