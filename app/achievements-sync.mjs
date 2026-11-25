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
 const stats=codewars?
  [{value:data?.honor,label_ar:'نقاط الشرف',label_en:'Honor points'},{value:data?.codeChallenges?.totalAuthored,label_ar:'تحديات منشأة',label_en:'Authored challenges'}]:
  [{value:data?.followers,label_ar:'متابعون',label_en:'Followers'},{value:data?.public_gists,label_ar:'مقتطفات عامة',label_en:'Public gists'}];
 const extra_stats=stats.filter(s=>Number.isSafeInteger(s.value)&&s.value>=0&&s.value<=100000000);
 const profile_name=String((codewars?data?.username:data?.name||data?.login)||'').slice(0,80).trim();
 return {metric_value:count,metric_label_ar:codewars?'تحديًا مكتملًا':'مستودعًا عامًا',metric_label_en:codewars?'Completed challenges':'Public repositories',extra_stats,profile_name,source:'api',updated_at:new Date().toISOString()};
}
