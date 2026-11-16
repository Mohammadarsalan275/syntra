import {tavily as Tavily} from "@tavily/core"

const tavily = Tavily({
    apiKey :Process.env.TAVILY_API_KEY,
})

export const searchInternet = async (quary) =>{
    return await tavily.search(quary,{
        
    })
}