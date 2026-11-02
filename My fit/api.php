<?php
session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','lifetime'=>60*60*24*30]);
session_start();
header('Content-Type: application/json');
$config=require __DIR__.'/config.php';
$db=$config['database'];
$pdo=new PDO("mysql:host={$db['host']};dbname={$db['name']};charset={$db['charset']}",$db['username'],$db['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$in=json_decode(file_get_contents('php://input'),true)?:[];
$a=$_GET['a']??'';
function q($sql,$p=[]){global $pdo;$s=$pdo->prepare($sql);$s->execute($p);return $s;}
function uid(){if(empty($_SESSION['uid'])){http_response_code(401);die('{"error":"auth"}');}return (int)$_SESSION['uid'];}
function cfg(){return array_column(q('SELECT k,v FROM settings WHERE user_id=?',[uid()])->fetchAll(),'v','k');}
function d($v){return preg_match('/^\d{4}-\d{2}-\d{2}$/',$v)?$v:date('Y-m-d');}
function fail($m){http_response_code(400);die(json_encode(['error'=>$m]));}
function login($u){session_regenerate_id(true);$_SESSION['uid']=$u['id'];echo json_encode(['user'=>['name'=>$u['name'],'email'=>$u['email']]]);}
try{switch($a){
case 'register':
 $n=trim($in['name']??'');$e=strtolower(trim($in['email']??''));$p=$in['password']??'';
 if(!$n)fail('Enter your name');if(!filter_var($e,FILTER_VALIDATE_EMAIL))fail('Enter a valid email');if(strlen($p)<6)fail('Password needs at least 6 characters');
 if(q('SELECT id FROM users WHERE email=?',[$e])->fetch())fail('This email is already registered');
 q('INSERT INTO users(name,email,pass_hash) VALUES(?,?,?)',[substr($n,0,80),$e,password_hash($p,PASSWORD_DEFAULT)]);
 $id=(int)$pdo->lastInsertId();
 foreach([['step_target',8000],['min_target',45],['spm',100]] as $s)q('INSERT INTO settings VALUES(?,?,?)',[$id,$s[0],$s[1]]);
 foreach([['Drink 8 glasses of water','10:00'],['Morning stretching','07:00'],['Meditation','06:30'],['Healthy breakfast','08:30'],['Read 10 minutes','20:00'],['Sleep by 10 PM','21:45']] as $h)q('INSERT INTO habits(user_id,name,remind_time) VALUES(?,?,?)',[$id,$h[0],$h[1]]);
 login(['id'=>$id,'name'=>$n,'email'=>$e]);break;
case 'login':
 $u=q('SELECT * FROM users WHERE email=?',[strtolower(trim($in['email']??''))])->fetch();
 if(!$u||!password_verify($in['password']??'',$u['pass_hash']))fail('Wrong email or password');
 login($u);break;
case 'logout': $_SESSION=[];session_destroy();echo '{"ok":1}';break;
case 'me':
 if(empty($_SESSION['uid'])){echo '{"user":null}';break;}
 $u=q('SELECT name,email FROM users WHERE id=?',[uid()])->fetch();echo json_encode(['user'=>$u?:null]);break;
case 'state':
 $dt=d($_GET['d']??'');$U=uid();
 echo json_encode(['acts'=>q('SELECT * FROM activities WHERE user_id=? AND act_date=? ORDER BY id DESC',[$U,$dt])->fetchAll(),
 'habits'=>q('SELECT h.*,(SELECT COUNT(*) FROM habit_logs l WHERE l.habit_id=h.id AND l.log_date=?) done FROM habits h WHERE user_id=? ORDER BY remind_time,id',[$dt,$U])->fetchAll(),
 'cfg'=>cfg()]);break;
case 'add_activity':
 $sec=max(1,(int)$in['duration_sec']);$type=in_array($in['type'],['walking','workout','yoga'])?$in['type']:'workout';
 $steps=$type=='walking'?(int)round($sec/60*(float)cfg()['spm']):0;
 q('INSERT INTO activities(user_id,type,name,duration_sec,steps,act_date) VALUES(?,?,?,?,?,?)',[uid(),$type,substr(trim($in['name']??'')?:ucfirst($type),0,100),$sec,$steps,d($in['date']??'')]);
 echo json_encode(['ok'=>1,'steps'=>$steps]);break;
case 'del_activity': q('DELETE FROM activities WHERE id=? AND user_id=?',[(int)$in['id'],uid()]);echo '{"ok":1}';break;
case 'add_habit':
 if(!trim($in['name']??''))fail('Enter a habit name');
 q('INSERT INTO habits(user_id,name,remind_time,is_manual) VALUES(?,?,?,1)',[uid(),substr(trim($in['name']),0,100),$in['remind_time']?:null]);echo '{"ok":1}';break;
case 'del_habit': q('DELETE FROM habits WHERE id=? AND user_id=?',[(int)$in['id'],uid()]);echo '{"ok":1}';break;
case 'toggle_habit':
 $dt=d($in['date']??'');$id=(int)$in['id'];
 if($in['done'])q('INSERT IGNORE INTO habit_logs SELECT id,? FROM habits WHERE id=? AND user_id=?',[$dt,$id,uid()]);
 else q('DELETE l FROM habit_logs l JOIN habits h ON h.id=l.habit_id WHERE l.habit_id=? AND l.log_date=? AND h.user_id=?',[$id,$dt,uid()]);
 echo '{"ok":1}';break;
case 'save_settings':
 foreach(['step_target','min_target','spm'] as $k)if(isset($in[$k]))q('REPLACE INTO settings VALUES(?,?,?)',[uid(),$k,max(1,(int)$in[$k])]);
 echo '{"ok":1}';break;
case 'month':
 $U=uid();$ym=preg_match('/^\d{4}-\d{2}$/',$_GET['ym']??'')?$_GET['ym']:date('Y-m');
 $days=q('SELECT act_date d,SUM(steps) steps,SUM(duration_sec) sec FROM activities WHERE user_id=? AND act_date LIKE ? GROUP BY act_date',[$U,"$ym-%"])->fetchAll();
 $hab=array_column(q('SELECT l.log_date d,COUNT(*) c FROM habit_logs l JOIN habits h ON h.id=l.habit_id WHERE h.user_id=? AND l.log_date LIKE ? GROUP BY l.log_date',[$U,"$ym-%"])->fetchAll(),'c','d');
 $types=q('SELECT type,COUNT(*) n FROM activities WHERE user_id=? AND act_date LIKE ? GROUP BY type',[$U,"$ym-%"])->fetchAll();
 echo json_encode(['days'=>$days,'habits'=>$hab,'total_habits'=>(int)q('SELECT COUNT(*) c FROM habits WHERE user_id=?',[$U])->fetch()['c'],'types'=>$types,'cfg'=>cfg()]);break;
default: fail('Bad action');
}}catch(Exception $e){http_response_code(500);echo json_encode(['error'=>'Server error: '.$e->getMessage()]);}
