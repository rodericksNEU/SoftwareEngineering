import axios, { AxiosResponse } from 'axios';

// all references to axios are localized here

// where to send the requests
axios.defaults.baseURL = 'https://rest-example.covey.town';

export async function remoteGet<T>(path:string) : Promise<T> {
  try {
    const response : AxiosResponse<T> = await axios.get(path);
    return (response.data);
  } catch (e) { throw new Error(e); }
}

export async function remoteDelete<T>(path:string) : Promise<T> {
  try {
    const response : AxiosResponse<T> = await axios.delete(path);
    return (response.data);
  } catch (e) { throw new Error(e); }
}

export async function remotePost<T>(path:string, data?:any) : Promise<T> {
  try {
    const response : AxiosResponse<T> = await axios.post(path, data);
    return (response.data);
  } catch (e) { throw new Error(e); }
}

