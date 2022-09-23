const _ = require("lodash");
const schedule = require("node-schedule");
const firebaseAdmin = require("../firebase");

const User = require("../models/userModel");
const Task = require("../models/taskModel");
const taskModel = require("../models/taskModel");

function setTimeout_(fn, delay) {
  var maxDelay = Math.pow(2, 31) - 1;

  if (delay > maxDelay) {
    var args = arguments;
    args[1] -= maxDelay;

    return setTimeout(function () {
      setTimeout_.apply(undefined, args);
    }, maxDelay);
  }

  return setTimeout.apply(undefined, arguments);
}

const scheduledTime = (task) => {
  const day = new Date(task.next).getDay();
  const date = new Date(task.next).getDate();
  const hours = task.time !== "allDay" ? new Date(task.next).getHours() : 0;
  const minutes = task.time !== "allDay" ? new Date(task.next).getMinutes() : 0;

  let cron;
  let rule;

  if (task.frequency === "once") {
    cron = new Date(task.next);
  } else if (task.frequency === "daily") {
    cron = `${minutes} ${hours} * * *`;
  } else if (task.frequency === "weekly") {
    cron = `${minutes} ${hours} * * ${day}`;
  } else if (task.frequency === "monthly") {
    cron = `${minutes} ${hours} ${date} * *`;
  }

  if (cron && task.end.by !== "date") {
    rule = {
      start: new Date(task.next),
      end: new Date(999999999999999),
      rule: cron,
    };
  }
  if (cron && task.end.by === "date") {
    rule = {
      start: new Date(task.next),
      end: new Date(`${task.end.on}`),
      rule: cron,
    };
  }

  return cron;
};

const updateTask = async (payload, task) => {
  const updatedTask = await Task.findByIdAndUpdate(
    task._id.toString(),
    payload,
    {
      new: true,
    }
  );
  console.log("updated task", updatedTask);
};

const scheduledJob = async (task) => {
  console.log(scheduledTime(task));
  const job = schedule.scheduleJob(
    task._id.toString(),
    scheduledTime(task),
    async () => {
      const users = await User.find({});
      const chunks = _.chunk(users, 500);
      const promises = chunks.map(async (chunk) => {
        const tokens = [];
        chunk.forEach((user) => {
          if (user.fcmToken) {
            tokens.push(user.fcmToken);
          }
        });
        const payload = {
          tokens,
          title: task.name,
          body: task.description ? task.description : "",
        };
        return firebaseAdmin
          .sendMulticastNotification(payload)
          .then((response) => console.log(response));
      });
      await Promise.all(promises);

      console.log("next", new Date(job.nextInvocation()));

      //update task
      updateTask(
        {
          occurrence: (task.occurrence += 1),
          next: new Date(job.nextInvocation()),
        },
        task
      );

      //finish task if once
      if (task.frequency === "once") {
        updateTask(
          {
            status: "finished",
          },
          task
        );
        schedule.cancelJob(task._id.toString());
        console.log("task finished");
      }

      // finish task by occurrence
      if (task.end.by === "occurrence") {
        if (task.end.on === task.occurrence) {
          updateTask(
            {
              status: "finished",
            },
            task
          );
          schedule.cancelJob(task._id.toString());
          console.log("task finished");
        }
      }
    }
  );
};

const createSchedule = async (task) => {
  try {
    /* if (new Date(task.next) - Date.now() < 10000) {
      await scheduledJob(task);
    } */
    setTimeout_(async () => {
      await scheduledJob(task);

      if (task.end.by === "date") {
        schedule.scheduleJob(new Date(task.end.on), () => {
          schedule.cancelJob(task._id);
        });
      }
    }, new Date(task.next) - Date.now() - 10000);
  } catch (error) {
    throw error;
  }
};

const reSchedule = async () => {
  try {
    const tasks = await Task.find({});

    tasks.forEach(async (task) => {
      if (task.status === "ongoing") {
        setTimeout_(async () => {
          await scheduledJob(task);
          if (task.end.by === "date") {
            schedule.scheduleJob(new Date(task.end.on), () => {
              schedule.cancelJob(task._id);
            });
          }
        }, new Date(task.next) - Date.now() - 10000);

        if (task.end.by === "date") {
          await scheduler.scheduleCancelJob(new Date(task.end.on), task._id);
        }
      }
    });
  } catch (error) {
    throw error;
  }
};

const scheduleCancelJob = async (scheduledCancel, task) => {
  schedule.scheduleJob(scheduledCancel, () => {
    schedule.cancelJob(task);
  });
};

const getJobs = () => {
  return schedule.scheduledJobs;
};

const scheduler = {
  createSchedule,
  reSchedule,
  getJobs,
  scheduleCancelJob,
};

module.exports = scheduler;
