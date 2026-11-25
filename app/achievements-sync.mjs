import {achievementURL,codewarsUsername,githubUsername} from './achievements.js';
// No arbitrary URL fetches: use allowlisted public provider APIs on fixed hosts.
export async function fetchAchievementMetric(url,{fetcher=fetch}={}){
 achievementURL(url);
 const codewars=codewarsUsername(url),github=githubUsername(url);
 if(!codewars&&!github)throw Error('Automatic refresh is unavailable for this platform. Use a manual metric with a public evidence link.');
 const apiURL=codewars?'https://www.codewars.com/api/v1/users/'+encodeURIComponent(codewars):'https://api.github.com/users/'+encodeURIComponent(github);
 let response;
 try{response=await fetcher(apiURL,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6000),redirect:'error'});}catch{throw Error('The public provider API is temporarily unavailable')}
 if(!response.ok)throw Error('The public profile could not be read');
 let data;try{data=await response.json()}catch{throw Error('Invalid provider response')}
 const count=codewars?data?.codeChallenges?.totalCompleted:data?.public_repos;
 if(!Number.isSafeInteger(count)||count<0||count>100000000)throw Error('The provider did not return a valid metric');
 return {metric_value:count,metric_label_ar:codewars?'تحديًا مكتملًا':'مستودعًا عامًا',metric_label_en:codewars?'Completed challenges':'Public repositories',source:'api',updated_at:new Date().toISOString()};
}
