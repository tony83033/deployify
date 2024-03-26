const express = require('express');
const {generateSlug} = require('random-word-slugs');
const Redis = require('ioredis');
const {Server} = require('socket.io')
const {ECSClient,RunTaskCommand} = require('@aws-sdk/client-ecs');
const app = express();
const PORT = 9000;

const redisSubcriber = new Redis('rediss://default:AVNS_omCddpi9Pkp3uTnAcel@redis-deployify-tonystark83033-c11f.a.aivencloud.com:23302');

const io = new Server(
    {
        cors:'*'
    }
);

io.listen(9001,()=>{
    console.log(`Socket Server listening on port 9001`);
});

io.on('connection', (socket)=>{
    socket.on('subscribe',channel =>{
        socket.join(channel);
        socket.emit('message',`Joined to ${channel}`);
    })
})

const ecsClient = new ECSClient({
    region:'ap-south-1',
    credentials: {
        accessKeyId: 'AKIAU6GDWNLEQECIJW2F',
        secretAccessKey: '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'
    }
})

const config = {
    CLUSTER:"arn:aws:ecs:ap-south-1:339712830153:cluster/deployifyCluster",
    TASK_DEFINITION: "arn:aws:ecs:ap-south-1:339712830153:task-definition/deployify-builder-task",
}

app.use(express.json());

app.post('/deploy', async(req,res)=>{
    
    const {gitUrl, slug} = req.body;
    const projectSlug = slug ? slug : generateSlug();
    //run a container docker container
    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK_DEFINITION,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: [
                    'subnet-059782448d033ed26','subnet-08fdd16eeace3b911','subnet-0d655f6c6d206772f'
                ],
                securityGroups:['sg-016fd9f6cf8775a6d'],
                assignPublicIp: 'ENABLED'
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment:[
                        {
                            name:'GIT_REPO_URL',value:gitUrl
                        },
                        {
                            name:'PROJECT_ID',value:projectSlug
                        }
                    ]
                }
            ]
        }
    });

    await ecsClient.send(command);
    return res.status(200).json({status:'queued',data:{projectSlug,url:`http://${projectSlug}.localhost:8000`}});
})



 async function initRedisSubcribe(){
    console.log('starting redis subcribe');
    console.log('Subscribed to logs....');
    redisSubcriber.psubscribe('logs:*');
    redisSubcriber.on('pmessage',(pattern,channel,message)=>{
        io.to(channel).emit('message',message);
        console.log(message);
    })
}

initRedisSubcribe();
app.listen(PORT,()=>{
    console.log('API SERVER LISTENING ON PORT',PORT);
})