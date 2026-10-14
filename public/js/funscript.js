// 📝 FunScript — a simple coding language by @fun that compiles to JavaScript.
// Designed for beginners: clean syntax, translates to the `fun` API.

export function compileFunScript(src) {
  const lines = src.split('\n');
  const js = [];
  const stack = []; // track open blocks
  let indent = 0;

  const pad = () => '  '.repeat(indent);
  const push = (code) => js.push(pad() + code);

  const openBlock = (code) => { push(code + ' {'); stack.push(indent); indent++; };
  const closeBlocks = (targetIndent) => {
    while (indent > targetIndent) {
      indent--;
      push('}');
      stack.pop();
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const curIndent = raw.match(/^(\s*)/)[1].length;
    const level = Math.floor(curIndent / 2);
    closeBlocks(level);

    // --- Statements ---
    let m;
    // say "text" / shout "text"
    if (m = trimmed.match(/^(say|shout)\s+"([^"]*)"$/)) {
      push(`fun.${m[1]}(${JSON.stringify(m[2])});`);
    }
    // say variable
    else if (m = trimmed.match(/^(say|shout)\s+(.+)$/)) {
      push(`fun.${m[1]}(${translateExpr(m[2])});`);
    }
    // give player 50 tix
    else if (m = trimmed.match(/^give\s+(\w+)\s+(\d+)\s+tix$/)) {
      push(`fun.giveTix(${translateExpr(m[1])}, ${m[2]});`);
    }
    // teleport player to (x, y, z)
    else if (m = trimmed.match(/^teleport\s+(\w+)\s+to\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/)) {
      push(`fun.teleport(${translateExpr(m[1])}, ${m[2]}, ${m[3]}, ${m[4]});`);
    }
    // wait 1000
    else if (m = trimmed.match(/^wait\s+(\d+)$/)) {
      push(`await fun.wait(${m[1]});`);
    }
    // set x to 5 / set x to "hello"
    else if (m = trimmed.match(/^set\s+(\w+)\s+to\s+(.+)$/)) {
      push(`let ${m[1]} = ${translateExpr(m[2])};`);
    }
    // on start: / on touch "name": / every 5 seconds:
    else if (m = trimmed.match(/^on\s+start\s*:$/)) {
      openBlock(`(async () =>`);
    }
    else if (m = trimmed.match(/^on\s+touch\s+"([^"]+)"\s*:$/)) {
      openBlock(`fun.onTouch(${JSON.stringify(m[1])}, async (player)`);
    }
    else if (m = trimmed.match(/^on\s+join\s*:$/)) {
      openBlock(`fun.onJoin(async (player)`);
    }
    else if (m = trimmed.match(/^every\s+(\d+)\s+seconds?\s*:$/)) {
      openBlock(`setInterval(async ()`);
    }
    // if x > 5:
    else if (m = trimmed.match(/^if\s+(.+)\s*:$/)) {
      openBlock(`if (${translateExpr(m[1])})`);
    }
    // repeat 5 times:
    else if (m = trimmed.match(/^repeat\s+(\d+)\s+times?\s*:$/)) {
      openBlock(`for (let _i = 0; _i < ${m[1]}; _i++)`);
    }
    // log
    else if (m = trimmed.match(/^log\s+(.+)$/)) {
      push(`fun.log(${translateExpr(m[1])});`);
    }
    else {
      // Unknown — pass through as JS comment
      push(`// [FunScript] Unknown: ${trimmed}`);
    }
  }
  closeBlocks(0);
  return js.join('\n');
}

function translateExpr(expr) {
  expr = expr.trim();
  // String literal
  if (/^".*"$/.test(expr)) return expr;
  // Number
  if (/^-?[\d.]+$/.test(expr)) return expr;
  // player.name, player.pos etc.
  if (/^player\.\w+$/.test(expr)) return expr;
  // Concatenation with +
  if (expr.includes('+')) {
    return expr.split('+').map(p => translateExpr(p.trim())).join(' + ');
  }
  // Variable
  if (/^\w+$/.test(expr)) return expr;
  return JSON.stringify(expr);
}

// Example FunScript:
export const FUNSCRIPT_EXAMPLE = `# My first FunScript
on start:
  shout "Welcome to my game!"

on touch "door":
  say "You found the door!"
  give player 50 tix
  teleport player to (0, 10, 0)

every 30 seconds:
  say "Tip: explore to find secrets!"`;
