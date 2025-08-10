import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import authClient from "~/auth/client";
import { z } from "zod";
import { FieldInfo } from "~/components/FieldInfo";

export const Route = createFileRoute("/(auth)/signup")({
  component: SignupForm,
});

const SignUpSchema = z
  .object({
    name: z.string().min(3, "You must have a length of at least 3"),
    email: z.email(),
    password: z.string().min(8, "You must have a length of at least 8"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

function SignupForm() {
  const { redirectUrl } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirm_password: "",
    },
    validators: {
      onChange: SignUpSchema,
    },
    onSubmit: ({ value }) => {
      authClient.signUp.email(
        {
          name: value.name,
          email: value.email,
          password: value.password,
          callbackURL: redirectUrl,
        },
        {
          onError: (ctx) => {
            setErrorMessage(ctx.error.message);
            setIsLoading(false);
          },
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["user"] });
            navigate({ to: redirectUrl });
          },
        }
      );
    },
  });

  return (
    <div className="flex flex-col items-center justify-center with-full h-fit p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-5">
            <form.Field name="name">
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <label htmlFor={field.name} className="floating-label">
                      <span>Your Name</span>
                      <input
                        id={field.name}
                        name={field.name}
                        className="input"
                        value={field.state.value}
                        placeholder="John Doe"
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </label>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field name="email">
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <label htmlFor={field.name} className="floating-label">
                      <span>Your Email</span>
                      <input
                        id={field.name}
                        name={field.name}
                        type="email"
                        placeholder="hello@example.com"
                        className="input"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </label>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field name="password">
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <label htmlFor={field.name} className="floating-label">
                      <span>Your Password</span>
                      <input
                        id={field.name}
                        name={field.name}
                        type="password"
                        placeholder="Enter password here"
                        className="input"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </label>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Field
              name="confirm_password"
              validators={{
                onChangeListenTo: ["password"], // Ensure this field listens to changes in the password field
              }}
            >
              {(field) => {
                // Avoid hasty abstractions. Render props are great!
                return (
                  <>
                    <label htmlFor={field.name} className="floating-label">
                      <span>Confirm password</span>
                      <input
                        id={field.name}
                        name={field.name}
                        type="password"
                        placeholder="Confirm password here"
                        className="input"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                      />
                    </label>
                    <FieldInfo field={field} />
                  </>
                );
              }}
            </form.Field>

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <button type="submit" className="btn" disabled={!canSubmit}>
                  {isSubmitting ? "Signing up..." : "Sign up"}
                </button>
              )}
            </form.Subscribe>
          </div>
          {errorMessage && (
            <div role="alert" className="alert alert-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 shrink-0 stroke-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              className="btn bg-black text-white border-black"
              type="button"
              disabled={isLoading}
              onClick={() =>
                authClient.signIn.social(
                  {
                    provider: "github",
                    callbackURL: redirectUrl,
                  },
                  {
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                  }
                )
              }
            >
              <svg
                aria-label="GitHub logo"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <path
                  fill="white"
                  d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
                ></path>
              </svg>
              Login with GitHub
            </button>
            <button
              className="btn bg-white text-black border-[#e5e5e5]"
              type="button"
              disabled={isLoading}
              onClick={() =>
                authClient.signIn.social(
                  {
                    provider: "google",
                    callbackURL: redirectUrl,
                  },
                  {
                    onRequest: () => {
                      setIsLoading(true);
                      setErrorMessage("");
                    },
                    onError: (ctx) => {
                      setIsLoading(false);
                      setErrorMessage(ctx.error.message);
                    },
                  }
                )
              }
            >
              <svg
                aria-label="Google logo"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
              >
                <g>
                  <path d="m0 0H512V512H0" fill="#fff"></path>
                  <path
                    fill="#34a853"
                    d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
                  ></path>
                  <path
                    fill="#4285f4"
                    d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"
                  ></path>
                  <path
                    fill="#fbbc02"
                    d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"
                  ></path>
                  <path
                    fill="#ea4335"
                    d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
                  ></path>
                </g>
              </svg>
              Login with Google
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
