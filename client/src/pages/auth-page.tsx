import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, loginSchema, registerSchema } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      displayName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate(data);
  };

  if (user) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Left Side - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 512 512" className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm122.422 139.405l-6.477 12.991c-15.856 31.703-53.146 44.575-85.019 28.741l-64.559-32.226a64.445 64.445 0 00-57.638 0l-64.559 32.226c-31.874 15.855-69.163 2.962-85.019-28.741l-6.477-12.991C56.497 185.139 96.142 236.973 151.187 267.5c22.434 12.438 47.317 18.968 72.481 18.968h64.664c25.164 0 50.047-6.53 72.481-18.968 55.045-30.527 94.69-82.361 117.609-128.095z"/>
              </svg>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-primary to-blue-500 text-transparent bg-clip-text">NeoSync</h1>
            </div>
          </div>

          <Tabs 
            value={activeTab} 
            onValueChange={value => setActiveTab(value as "login" | "register")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Login</CardTitle>
                  <CardDescription>
                    Enter your credentials to access your account
                  </CardDescription>
                </CardHeader>
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                    <CardContent className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Sign In
                      </Button>
                    </CardFooter>
                  </form>
                </Form>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create an account</CardTitle>
                  <CardDescription>
                    Enter your information to create a new account
                  </CardDescription>
                </CardHeader>
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                    <CardContent className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                    <CardFooter>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Create Account
                      </Button>
                    </CardFooter>
                  </form>
                </Form>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Side - Hero */}
      <div className="hidden md:flex md:w-1/2 bg-primary/10 dark:bg-primary/5 p-12 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="flex justify-center mb-8">
            <svg viewBox="0 0 512 512" className="w-24 h-24 text-primary" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0zm122.422 139.405l-6.477 12.991c-15.856 31.703-53.146 44.575-85.019 28.741l-64.559-32.226a64.445 64.445 0 00-57.638 0l-64.559 32.226c-31.874 15.855-69.163 2.962-85.019-28.741l-6.477-12.991C56.497 185.139 96.142 236.973 151.187 267.5c22.434 12.438 47.317 18.968 72.481 18.968h64.664c25.164 0 50.047-6.53 72.481-18.968 55.045-30.527 94.69-82.361 117.609-128.095z"/>
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white bg-gradient-to-r from-primary to-blue-500 text-transparent bg-clip-text">
            Securely connect in the digital frontier
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            NeoSync is a next-generation messenger that prioritizes your privacy with quantum-resistant encryption for all communications.
          </p>
          <div className="grid grid-cols-2 gap-6 text-left">
            <div className="flex items-start gap-2">
              <div className="bg-primary/20 dark:bg-primary/30 p-2 rounded-full">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium mb-1 text-gray-900 dark:text-white">Private Messaging</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">End-to-end encrypted messages only you and recipients can read.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-primary/20 dark:bg-primary/30 p-2 rounded-full">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 8L21 12M21 12L17 16M21 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium mb-1 text-gray-900 dark:text-white">Real-time Updates</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Instant message delivery and read receipts.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-primary/20 dark:bg-primary/30 p-2 rounded-full">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 11V14M12 17H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0378 2.66667 10.268 4L3.33978 16C2.56998 17.3333 3.53223 19 5.07183 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium mb-1 text-gray-900 dark:text-white">No Data Collection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">We don't store your messages or data on our servers.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-primary/20 dark:bg-primary/30 p-2 rounded-full">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium mb-1 text-gray-900 dark:text-white">Works Everywhere</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Available on desktop and mobile devices.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
