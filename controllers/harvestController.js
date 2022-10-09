const asyncHandler = require("express-async-handler");

const Harvest = require("../models/harvestModel");
const Batch = require("../models/batchModel");

const getHarvests = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  // find batch by supplied batch id
  const batch = await Batch.findById(batchId).populate("harvests");
  // check if batch is returned
  if (!batch) {
    res.status(400);
    throw new Error("Batch not found");
  }
  // verify if creator owns the batch
  if (batch.owner.toString() !== req.user.id) {
    res.status(400);
    throw new Error("Unable to modify batch");
  }

  res.status(200).json(batch.harvests);
});

const setHarvest = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  // get batch from body
  const batch = await Batch.findById(batchId).populate("harvests");
  // check if batch is returned
  if (!batch) {
    res.status(400);
    throw new Error("Batch not found");
  }

  // const harvests = await Harvest.find();

  const duplicate = batch.harvests.some((harvest) => {
    return (
      new Date(harvest.createdAt).toDateString() === new Date().toDateString()
    );
  });

  if (duplicate) {
    res.status(400);
    throw new Error("You cannot create more than one entry of harvest per day");
  }

  // verify if creator owns the batch
  if (batch.owner.toString() !== req.user.id) {
    res.status(400);
    throw new Error("Unable to modify batch");
  }

  const harvest = await Harvest.create({
    batch: batchId,
    datetime: new Date(new Date().toDateString()),
    weight: req.body.weight,
  });

  await Batch.findByIdAndUpdate(
    batch.id,
    {
      harvests: [...batch.harvests, harvest.id],
    },
    { new: true }
  );

  res.status(200).json(harvest);
});

const updateHarvest = asyncHandler(async (req, res) => {
  const { harvestId } = req.params;

  const updatedHarvest = await Harvest.findByIdAndUpdate(harvestId, req.body, {
    new: true,
  });

  res.status(200).json(updatedHarvest);
});

const deleteHarvest = asyncHandler(async (req, res) => {
  const { harvestId } = req.params;

  const harvest = await Harvest.findById(harvestId);

  if (!harvest) {
    res.status(200);
    throw new Error("harvest not found");
  }

  await harvest.remove();

  res.status(200).json({
    message: "Deleted harvest " + harvestId,
  });
});

module.exports = {
  getHarvests,
  setHarvest,
  updateHarvest,
  deleteHarvest,
};
