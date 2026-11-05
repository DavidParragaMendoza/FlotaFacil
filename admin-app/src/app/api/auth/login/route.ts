import axios from "axios";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { loginSchema } from "@/server/contracts/auth-schema";
import { auth } from "@/server/services/core/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { cpf, senha } = loginSchema.parse(body);

    const { token } = await auth(cpf, senha);

    const res = NextResponse.json({ success: true });

    res.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res;
  } catch (err: unknown) {
    if (err instanceof SyntaxError || err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados de login inválidos" },
        { status: 400 },
      );
    }

    if (axios.isAxiosError(err) && !err.response) {
      console.error("Serviço core-service indisponível no login:", err.message);
      return NextResponse.json(
        {
          error:
            "Não foi possível conectar ao servidor central (verifique se o core-service está em execução).",
        },
        { status: 503 },
      );
    }

    console.error(err);
    return NextResponse.json(
      { error: "Credenciais inválidas" },
      { status: 401 },
    );
  }
}
