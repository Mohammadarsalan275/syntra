import { useDispatch } from "react-redux";
import { register, login, getMe } from "../auth/service/auth.api";
import { setUser, setError, setLoading } from "../auth/auth.slice";

export function useAuth() {
  const dispatch = useDispatch();

  async function handleRegister({ email, username, password }) {
    try {
      dispatch(setLoading(true));
      const data = await register({ email, username, password });
      dispatch(setError(null));
      await register({ email, username, password });
      return true;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Registration failed"),
      );
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }

  async function handleGetMe() {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));
      const data = await getMe();
      dispatch(setUser(data));
      return true;
    } catch (error) {
      dispatch(
        setError(error.response?.data?.message || "Failed to fetch user data"),
      );
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }

  async function handleLogin({ email, password }) {
    try {
      dispatch(setLoading(true));
      dispatch(setError(null));
      const data = await login({ email, password });
      dispatch(setUser(data.user));
      return true;
    } catch (error) {
      dispatch(setError(error.response?.data?.message || "Login failed"));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }

  return {
    handleRegister,
    handleGetMe,
    handleLogin,
  };
}
