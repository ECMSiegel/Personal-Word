import { test, expect } from "@playwright/test";

async function create(page: any, title: string, advanceClock = 0) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  if (advanceClock) await page.clock.runFor(advanceClock);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}
const settings = (page: any) => page.locator(".group-title").filter({hasText:/^Settings$/}).click();
const manuscript = (page: any) => page.locator(".group-title").filter({hasText:/^Manuscript$/}).click();
const goalOptionLabel: Record<string, string> = { manuscript: "Manuscript", "manuscript-and-fragments": "Manuscript and fragments", local: "Local day", utc: "UTC day" };
const pick = async (page: any, control: string, value: string) => {
  await page.getByLabel(control, { exact: true }).click();
  await page.getByRole("option", { name: goalOptionLabel[value], exact: true }).click();
};

test("goal scope and day preferences persist and start explicit fresh baselines", async ({page}) => {
  const session=await page.context().newCDPSession(page);
  await session.send("Emulation.setTimezoneOverride",{timezoneId:"America/New_York"});
  // UTC is already the next day. Reload must not overwrite the UTC baseline
  // while the project's day-mode preference is still loading.
  await page.clock.setFixedTime(new Date("2026-10-23T02:00:00Z"));
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs","true"));
  await create(page,"Scoped goals");
  const editor=page.getByRole("textbox",{name:"Writing editor"});
  await editor.fill("one two three");
  await settings(page);
  await page.getByLabel("Daily word goal",{exact:true}).fill("10");
  await pick(page,"Goal scope","manuscript-and-fragments");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("0 of 10 today");
  await manuscript(page);
  await editor.fill("one two three four five");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("2 of 10 today");
  await settings(page);
  await pick(page,"Goal day","utc");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("0 of 10 today");
  await manuscript(page);
  await editor.fill("one two three four five six");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("1 of 10 today");
  await expect(page.getByText("Saved",{exact:true})).toBeVisible();
  await page.reload();
  await settings(page);
  await expect(page.getByLabel("Goal scope",{exact:true})).toContainText("Manuscript and fragments");
  await expect(page.getByLabel("Goal day",{exact:true})).toContainText("UTC day");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("1 of 10 today");
  await pick(page,"Goal day","local");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("0 of 10 today");
  await pick(page,"Goal day","utc");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("0 of 10 today");
  await pick(page,"Goal day","local");
  await manuscript(page);
  await editor.fill("one two three four five six seven");
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("1 of 10 today");
  await session.send("Emulation.setTimezoneOverride",{timezoneId:"Pacific/Honolulu"});
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("Writing goals",{exact:true})).toContainText("0 of 10 today");
  await session.detach();
});

for (const mode of ["local", "utc"] as const) {
  test(`goal calendar resets its baseline at ${mode} midnight`, async ({ page }) => {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" });
    const midnight = new Date(mode === "utc" ? "2026-10-23T00:00:00Z" : "2026-10-23T04:00:00Z");
    await page.clock.install({ time: new Date(midnight.getTime() - 60_000) });
    await create(page, `${mode} midnight goals`, 1000);
    const editor = page.getByRole("textbox", { name: "Writing editor" });
    const progress = page.getByLabel("Writing goals", { exact: true });
    await editor.fill("one");
    await settings(page);
    await page.getByLabel("Daily word goal", { exact: true }).fill("10");
    if (mode === "utc") await pick(page,"Goal day","utc");
    await manuscript(page);
    await editor.fill("one two");
    // Legacy local goals retain the opening zero-word baseline; selecting UTC
    // explicitly starts a new baseline after the first word.
    const before = mode === "local" ? 2 : 1;
    await expect(progress).toContainText(`${before} of 10 today`);
    await page.clock.pauseAt(new Date(midnight.getTime() - 1000));
    await expect(progress).toContainText(`${before} of 10 today`);
    await page.clock.runFor(1100);
    await expect(progress).toContainText("0 of 10 today");
    await settings(page);
    await expect(page.locator(".settings-help").filter({ hasText: "Current baseline:" }))
      .toContainText("Current baseline: 2 words on 2026-10-23.");
    await manuscript(page);
    await editor.fill("one two three");
    await expect(progress).toContainText("1 of 10 today");
    await session.detach();
  });
}

// Use a production-preview server for qualification. A development-server run
// still checks fixture reachability and the same budget, but is not a release
// performance claim. Paired samples and exact fixture sizes are attached.
for (const pathological of [false, true]) {
test(`100k words across 60 sections and 1000 notes meet the synthetic input budget -- ${pathological ? "repeated-word paragraph" : "ordinary sections"}`, async ({page}, info) => {
  test.setTimeout(180_000);
  await create(page,"Large writing benchmark");
  await page.evaluate((pathological) => {
    const key=Object.keys(localStorage).find(key=>key.startsWith("folio.preview.project."))!;
    const p=JSON.parse(localStorage.getItem(key)!);
    const original=p.entries[0];
    let remaining=100_000;
    p.entries=Array.from({length:60},(_,i)=>{
      const count=i===0?10_000:Math.floor(remaining/(60-i));
      remaining-=count;
      const blocks=[];
      for(let start=0;start<count;start+=100){
        const text=Array.from({length:Math.min(100,count-start)},(_,j)=>["alpha","beta","gamma","delta","evidence"][j%5]).join(" ")+".";
        blocks.push({type:"paragraph",content:[{type:"text",text}]});
      }
      if (pathological && i === 0) blocks.splice(0, blocks.length, {type:"paragraph",content:[{type:"text",text:Array(count).fill("the.").join(" ")}]});
      return {...original,id:crypto.randomUUID(),title:`Section ${i+1}`,content:{type:"doc",content:blocks},text:blocks.map(block=>block.content[0].text).join("\n")};
    });
    p.order=p.entries.map((e:any)=>e.id);
    p.research={sources:[],notes:[],footnotes:Array.from({length:1000},(_,i)=>({id:`benchmark-note-${i}`,text:`Supporting note ${i}.`}))};
    p.research.footnotes.forEach((note:any,i:number)=>p.entries[i%60].content.content.at(-1).content.push({type:"footnoteReference",attrs:{id:note.id}}));
    localStorage.setItem(key,JSON.stringify(p));
    localStorage.setItem("personal-word.restoreTabs","true");
    localStorage.setItem("folio.lastProject",p.id);
    localStorage.setItem("personal-word.prose-check","false");
  }, pathological);
  await page.reload();
  const editor=page.getByRole("textbox",{name:"Writing editor"});
  await expect(editor).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>{
    const key=Object.keys(localStorage).find(key=>key.startsWith("folio.preview.project."))!;
    const p=JSON.parse(localStorage.getItem(key)!);
    return {sections:p.entries.length,words:p.entries.reduce((sum:number,e:any)=>sum+e.text.trim().split(/\s+/u).length,0),notes:p.research.footnotes.length,activeWords:p.entries[0].text.trim().split(/\s+/u).length};
  })).toEqual({sections:60,words:100_000,notes:1000,activeWords:10_000});
  const sample=async()=>{
    await editor.press("ControlOrMeta+Home");
    await editor.evaluate((element:any)=>{
      const samples:number[]=[];let started:number|null=null;
      (window as any).__inputSamples=samples;
      const key=(event:KeyboardEvent)=>{if(event.key==="x")started=performance.now();};
      const update=()=>{if(started!==null){samples.push(performance.now()-started);started=null;}};
      element.addEventListener("keydown",key);
      element.editor.on("update",update);
      (window as any).__stopSamples=()=>{element.removeEventListener("keydown",key);element.editor.off("update",update);};
    });
    await editor.pressSequentially("x".repeat(200));
    return page.evaluate(()=>{(window as any).__stopSamples();return (window as any).__inputSamples as number[];});
  };
  const off=await sample();
  const more=page.getByRole("button",{name:"More formatting",exact:true});
  const prose=page.getByRole("button",{name:"Prose check",exact:true});
  if(!(await prose.isVisible()) && await more.isVisible())await more.click();
  await prose.click();
  await page.getByRole("checkbox",{name:"On",exact:true}).check();
  await expect(editor.locator(".prose-repeat").first()).toBeVisible({timeout:30_000});
  // Returning focus uses the current valid editor selection; no document reset.
  await editor.focus();
  const on=await sample();
  await info.attach("paired-input-samples",{body:JSON.stringify({fixture:{words:100_000,sections:60,notes:1000,activeWords:10_000},off,on}),contentType:"application/json"});
  expect(off).toHaveLength(200);expect(on).toHaveLength(200);
  const sorted=[...on].sort((a,b)=>a-b);
  expect(sorted[Math.floor(sorted.length/2)]).toBeLessThanOrEqual(25);
  expect(sorted[Math.ceil(sorted.length*.95)-1]).toBeLessThanOrEqual(50);
});

}

// Page view (wave 3, P2) re-measures page spacers after each edit; the same
// budget applies. About 29,000 words in one section, about 90 pages.
test("page view on a 90-page section meets the synthetic input budget", async ({page}, info) => {
  test.setTimeout(180_000);
  await create(page,"Page view benchmark");
  await page.evaluate(() => {
    const key=Object.keys(localStorage).find(key=>key.startsWith("folio.preview.project."))!;
    const p=JSON.parse(localStorage.getItem(key)!);
    const words=["alpha","beta","gamma","delta","evidence","measure","page"];
    const blocks:any[]=[];const footnotes:any[]=[];
    for(let i=0;i<640;i++){
      if(i%12===0)blocks.push({type:"heading",attrs:{level:2},content:[{type:"text",text:`Heading ${i/12+1}`}]});
      const content:any[]=[{type:"text",text:`P${i} `+Array.from({length:28+(i%9)*4},(_,j)=>words[(i+j)%7]).join(" ")+"."}];
      if(i%40===5){const id=`page-bench-${i}`;footnotes.push({id,text:`Note ${i}.`});content.push({type:"footnoteReference",attrs:{id}});}
      blocks.push({type:"paragraph",content});
    }
    p.entries[0].content={type:"doc",content:blocks};
    p.entries[0].text=blocks.map(b=>b.content.map((c:any)=>c.text??"").join("")).join("\n");
    p.research={...(p.research??{}),sources:[],notes:[],footnotes};
    localStorage.setItem(key,JSON.stringify(p));
    localStorage.setItem("personal-word.restoreTabs","true");
    localStorage.setItem("folio.lastProject",p.id);
    localStorage.setItem("personal-word.prose-check","false");
  });
  await page.reload();
  const editor=page.getByRole("textbox",{name:"Writing editor",exact:true});
  await expect(editor).toBeVisible();
  const toggle=page.getByRole("button",{name:"Page view",exact:true});
  if(!(await toggle.count()))await page.getByRole("button",{name:"More formatting"}).click();
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect.poll(()=>page.locator(".page-spacer").count()).toBeGreaterThan(40);
  const sample=async(where:"start"|"middle")=>{
    await editor.evaluate((element:any,where:string)=>{
      const ed=element.editor;
      let target=3;let index=0;
      if(where==="middle")ed.state.doc.forEach((_node:any,offset:number)=>{if(index++===Math.floor(ed.state.doc.childCount/2))target=offset+3;});
      ed.commands.setTextSelection(target);ed.commands.focus();
      const sync:number[]=[];const paint:number[]=[];let started:number|null=null;
      (window as any).__pageSamples={sync,paint};
      const key=(event:KeyboardEvent)=>{if(event.key!=="x")return;const t=performance.now();started=t;requestAnimationFrame(()=>requestAnimationFrame(()=>paint.push(performance.now()-t)));};
      const update=()=>{if(started!==null){sync.push(performance.now()-started);started=null;}};
      element.addEventListener("keydown",key);ed.on("update",update);
      (window as any).__stopPageSamples=()=>{element.removeEventListener("keydown",key);ed.off("update",update);};
    },where);
    await editor.pressSequentially("x".repeat(200));
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(r,200)))));
    return page.evaluate(()=>{(window as any).__stopPageSamples();return (window as any).__pageSamples as {sync:number[];paint:number[]};});
  };
  const start=await sample("start");
  const middle=await sample("middle");
  await info.attach("page-view-input-samples",{body:JSON.stringify({start,middle}),contentType:"application/json"});
  for(const run of [start,middle]){
    expect(run.sync).toHaveLength(200);
    const sorted=[...run.sync].sort((a,b)=>a-b);
    expect(sorted[Math.floor(sorted.length/2)]).toBeLessThanOrEqual(25);
    expect(sorted[Math.ceil(sorted.length*.95)-1]).toBeLessThanOrEqual(50);
  }
});
