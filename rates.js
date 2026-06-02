// Port of the deterministic dataset logic from RateNavigator.tsx + per-role premiums.
const CATEGORIES = [
  "Data & AI","Software Engineering","Business & Functional Analysis",
  "Project, Product & Agile Mgmt","IT Infra, Security & Support",
  "Design & UX","Other/Management",
];
function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function gaussian(rand){let u=0,v=0;while(u===0)u=rand();while(v===0)v=rand();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function generateDataset(){
  const rand=mulberry32(42);
  const categorySpecs={
    "Data & AI":{n:915,mean:690,sd:132,q1:580,median:700,q3:770,max:1300},
    "Software Engineering":{n:1716,mean:609,sd:118,q1:550,median:600,q3:680,max:1100},
    "Business & Functional Analysis":{n:1326,mean:627,sd:111,q1:550,median:650,q3:700,max:1050},
    "Project, Product & Agile Mgmt":{n:1857,mean:660,sd:125,q1:590,median:670,q3:740,max:1200},
    "IT Infra, Security & Support":{n:1308,mean:617,sd:146,q1:500,median:600,q3:700,max:1050},
    "Design & UX":{n:87,mean:577,sd:103,q1:500,median:600,q3:650,max:800},
    "Other/Management":{n:150,mean:620,sd:130,q1:520,median:600,q3:700,max:1100},
  };
  const seniorityMix={
    "Data & AI":{medior:264,senior:405},
    "Software Engineering":{medior:363,senior:894},
    "Business & Functional Analysis":{medior:315,senior:564},
    "Project, Product & Agile Mgmt":{medior:285,senior:753},
  };
  const seniorityUplift={"Data & AI":0.236,"Software Engineering":0.182,"Business & Functional Analysis":0.182,"Project, Product & Agile Mgmt":0.167};
  const jobs=[];let idCounter=1;
  for(const cat of CATEGORIES){
    const spec=categorySpecs[cat];const uplift=seniorityUplift[cat]??0.18;
    let mediorTarget=Math.round(seniorityMix[cat]?.medior??Math.round(spec.n*0.28));
    let seniorTarget=Math.round(seniorityMix[cat]?.senior??Math.round(spec.n*0.48));
    let remaining=spec.n-mediorTarget-seniorTarget;
    let juniorTarget=Math.max(0,Math.round(remaining*0.25));
    let unspecifiedTarget=Math.max(0,remaining-juniorTarget);
    const buckets=[...Array(mediorTarget).fill("Medior"),...Array(seniorTarget).fill("Senior/Expert"),...Array(juniorTarget).fill("Junior"),...Array(unspecifiedTarget).fill("Unspecified")];
    for(let i=0;i<spec.n;i++){
      const base=spec.mean+gaussian(rand)*spec.sd;
      let rate=clamp(Math.round(base),300,spec.max);
      const s=buckets[i]??"Unspecified";
      if(s==="Senior/Expert")rate=Math.round(rate*(1+uplift));
      if(s==="Junior")rate=Math.round(rate*0.85);
      rate=clamp(Math.round(rate*0.95),285,1281);
      jobs.push({id:idCounter++,category:cat,rate,seniority:s});
    }
  }
  return jobs;
}
function percentile(sorted,p){const idx=(p/100)*(sorted.length-1);const lo=Math.floor(idx),hi=Math.ceil(idx);if(lo===hi)return sorted[lo];const h=idx-lo;return Math.round(sorted[lo]*(1-h)+sorted[hi]*h);}
function median(nums){if(!nums.length)return 0;const s=[...nums].sort((a,b)=>a-b);return percentile(s,50);}

const data=generateDataset();
const SEN={Junior:"Junior",Mid:"Medior",Senior:"Senior/Expert"};
function domMedian(cat,sen){return median(data.filter(j=>j.category===cat&&j.seniority===SEN[sen]).map(j=>j.rate));}

// roles: [name, domain, premium]
const ROLES=[
  ["Data Engineer","Data & AI",0],["Data Analyst","Data & AI",-0.05],["Data Scientist","Data & AI",0.077],["ML/AI Engineer","Data & AI",0.077],["BI Developer (Power BI)","Data & AI",-0.154],["Analytics Engineer","Data & AI",0.05],
  ["Software Developer","Software Engineering",0],["Frontend Developer (React)","Software Engineering",0.06],["Backend Developer","Software Engineering",0.03],["Full-stack Developer","Software Engineering",0.06],["Mainframe/COBOL Developer","Software Engineering",0.083],
  ["Business Analyst","Business & Functional Analysis",0],["Functional Analyst","Business & Functional Analysis",-0.03],["Product Owner Analyst","Business & Functional Analysis",0.05],
  ["Project Manager","Project, Product & Agile Mgmt",0],["Product Manager","Project, Product & Agile Mgmt",0.05],["Scrum Master","Project, Product & Agile Mgmt",-0.03],["Agile Coach","Project, Product & Agile Mgmt",0.05],["Program Manager","Project, Product & Agile Mgmt",0.1],
  ["Cloud Engineer (Azure)","IT Infra, Security & Support",0.083],["DevOps Engineer","IT Infra, Security & Support",0.1],["Security Engineer","IT Infra, Security & Support",0.133],["System Administrator","IT Infra, Security & Support",-0.05],["Support Engineer","IT Infra, Security & Support",-0.1],
  ["UX Designer","Design & UX",0],["UI Designer","Design & UX",0],["Product Designer","Design & UX",0.05],
  ["IT Manager","Other/Management",0.1],["Consultant","Other/Management",0],["SAP Consultant","Other/Management",0.2],
];
console.log("Role\tDomain\tJunior\tMid\tSenior");
for(const [name,dom,prem] of ROLES){
  const j=Math.round(domMedian(dom,"Junior")*(1+prem));
  const m=Math.round(domMedian(dom,"Mid")*(1+prem));
  const s=Math.round(domMedian(dom,"Senior")*(1+prem));
  console.log(`${name}\t${dom}\t${j}\t${m}\t${s}`);
}
