import { supabase } from "./supabaseClient";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

export async function getSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  return session;
}

export function subscribeToAuth(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}