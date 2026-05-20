import ResetPasswordClient from "./ResetPasswordClient";

export default async function Page({ searchParams }) {

  const { token, email } = await searchParams;

  return (
    <ResetPasswordClient
      token={token}
      email={email}
    />
  );
}